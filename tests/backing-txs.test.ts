// TODO: @sk-saru refactor this file please!!!
import { Assets, Emulator, Lucid, Unit, UTxO } from "lucid-cardano";

import {
  compileBackingVScript,
  compileProjectSvScript,
  compileProofOfBackingMpScript,
  compileSharedTreasuryVScript,
  compileTeikiMpScript,
} from "@/commands/compile-scripts";
import { SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS } from "@/commands/generate-protocol-params";
import {
  PROJECT_AT_TOKEN_NAMES,
  PROOF_OF_BACKING_TOKEN_NAMES,
  PROTOCOL_NFT_TOKEN_NAMES,
  TEIKI_PLANT_NFT_TOKEN_NAME,
  TEIKI_TOKEN_NAME,
} from "@/contracts/common/constants";
import { exportScript } from "@/contracts/compile";
import { addressFromScriptHashes, signAndSubmit } from "@/helpers/lucid";
import {
  constructAddress,
  constructPlantHashUsingBlake2b,
  constructProjectIdUsingBlake2b,
  constructTxOutputId,
} from "@/helpers/schema";
import { getTime } from "@/helpers/time";
import * as S from "@/schema";
import { BackingDatum, Plant } from "@/schema/teiki/backing";
import { TeikiPlantDatum } from "@/schema/teiki/meta-protocol";
import {
  ProjectDatum,
  ProjectScriptDatum,
  ProjectStatus,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { SharedTreasuryDatum } from "@/schema/teiki/treasury";
import { claimRewardsByFlowerTx } from "@/transactions/backing/claim-rewards-by-flower";
import { CleanUpParams, cleanUpTx } from "@/transactions/backing/clean-up";
import { PlantParams, plantTx } from "@/transactions/backing/plant";
import { sortPlantByBackingOutputId } from "@/transactions/backing/utils";
import { MIN_UTXO_LOVELACE } from "@/transactions/constants";
import { Hex } from "@/types";

import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
  generateScriptAddress,
  generateWalletAddress,
} from "./emulator";
import { generateProtocolRegistry, getRandomLovelaceAmount } from "./utils";

// NOTE: Becareful with global emulator, one test fails may lead to others fails
const BACKER_ACCOUNT = await generateAccount();
const emulator = new Emulator([BACKER_ACCOUNT]);
const lucid = await Lucid.new(emulator);

// Context

const refScriptAddress = generateScriptAddress(lucid);
const projectAddress = generateScriptAddress(lucid);
const ownerAddress = generateWalletAddress(lucid);
const projectScriptAddress = generateScriptAddress(lucid);
const governorAddress = generateWalletAddress(lucid);
const stakingManagerAddress = generateWalletAddress(lucid);
const protocolParamsAddress = generateScriptAddress(lucid);

const projectId = constructProjectIdUsingBlake2b(generateOutRef());

const protocolSvHash = generateBlake2b224Hash();
const projectAtMph = generateBlake2b224Hash();
const projectATUnit: Unit = projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT;
const projectScriptATUnit: Unit =
  projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

const protocolNftMph = generateBlake2b224Hash();
const teikiPlantNftMph = generateBlake2b224Hash();

const teikiMintingPolicy = exportScript(
  compileTeikiMpScript({ teikiPlantNftMph })
);
const teikiMph = lucid.utils.validatorToScriptHash(teikiMintingPolicy);
const teikiUnit: Unit = teikiMph + TEIKI_TOKEN_NAME;

const proofOfBackingMintingPolicy = exportScript(
  compileProofOfBackingMpScript({ projectAtMph, protocolNftMph, teikiMph })
);
const proofOfBackingMph = lucid.utils.validatorToScriptHash(
  proofOfBackingMintingPolicy
);

const backingValidator = exportScript(
  compileBackingVScript({ proofOfBackingMph, protocolNftMph })
);
const backingVHash = lucid.utils.validatorToScriptHash(backingValidator);

const projectStakeValidator = exportScript(
  compileProjectSvScript({
    projectId,
    stakingSeed: "",
    projectAtMph,
    protocolNftMph,
  })
);

const backingScriptAddress = addressFromScriptHashes(
  lucid,
  backingVHash,
  lucid.utils.validatorToScriptHash(projectStakeValidator)
);

const sharedTreasuryValidator = exportScript(
  compileSharedTreasuryVScript({
    projectAtMph,
    protocolNftMph,
    teikiMph,
    proofOfBackingMph,
  })
);

const sharedTreasuryVHash = lucid.utils.validatorToScriptHash(
  sharedTreasuryValidator
);

const sharedTreasuryAddress = addressFromScriptHashes(
  lucid,
  sharedTreasuryVHash
);

const proofOfBackingMpRefUtxo: UTxO = {
  ...generateOutRef(),
  address: refScriptAddress,
  assets: { lovelace: MIN_UTXO_LOVELACE },
  scriptRef: proofOfBackingMintingPolicy,
};

const backingScriptRefUtxo: UTxO = {
  ...generateOutRef(),
  address: refScriptAddress,
  assets: { lovelace: MIN_UTXO_LOVELACE },
  scriptRef: backingValidator,
};

const sharedTreasuryVRefUtxo: UTxO = {
  ...generateOutRef(),
  address: refScriptAddress,
  assets: { lovelace: MIN_UTXO_LOVELACE },
  scriptRef: sharedTreasuryValidator,
};

const teikiMpRefUtxo: UTxO = {
  ...generateOutRef(),
  address: refScriptAddress,
  assets: { lovelace: 10_000_000n },
  scriptRef: teikiMintingPolicy,
};

const teikiPlantDatum: TeikiPlantDatum = {
  rules: {
    teikiMintingRules: [
      {
        mintingPolicyHash: { script: { hash: teikiMph } },
        redeemer: { kind: "ConstrNotIn", constrs: [2n] },
      },
    ],
    proposalAuthorizations: [],
    proposalWaitingPeriod: { milliseconds: 604800000n },
  },
  proposal: null,
};

const teikiPlantVRefUtxo: UTxO = {
  ...generateOutRef(),
  address: generateScriptAddress(lucid),
  assets: {
    [teikiPlantNftMph + TEIKI_PLANT_NFT_TOKEN_NAME]: 1n,
    lovelace: 10_000_000n,
  },
  datum: S.toCbor(S.toData(teikiPlantDatum, TeikiPlantDatum)),
};

const registry = generateProtocolRegistry(protocolSvHash, {
  backing: backingVHash,
  sharedTreasury: sharedTreasuryVHash,
});

const protocolParamsDatum: ProtocolParamsDatum = {
  registry,
  governorAddress: constructAddress(governorAddress),
  stakingManager: constructAddress(stakingManagerAddress).paymentCredential,
  ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
};

const protocolParamsNftUnit: Unit =
  protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

const protocolParamsUtxo: UTxO = {
  ...generateOutRef(),
  address: protocolParamsAddress,
  assets: { lovelace: MIN_UTXO_LOVELACE, [protocolParamsNftUnit]: 1n },
  datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
};

const projectScriptDatum: ProjectScriptDatum = {
  projectId: { id: projectId },
  stakingKeyDeposit: 1n,
};

const projectScriptUtxo: UTxO = {
  ...generateOutRef(),
  address: projectScriptAddress,
  assets: { lovelace: MIN_UTXO_LOVELACE, [projectScriptATUnit]: 1n },
  datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
  scriptRef: projectStakeValidator,
};

const initialProjectMilestone = 0n;
// End context

describe("backing transactions", () => {
  it("plant tx - back a project only", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const projectDatum: ProjectDatum = {
      projectId: { id: projectId },
      ownerAddress: constructAddress(ownerAddress),
      milestoneReached: initialProjectMilestone,
      isStakingDelegationManagedByProtocol: true,
      status: { type: "Active" },
    };

    const projectUtxo: UTxO = generateProjectUtxo(projectDatum);

    attachUtxos(emulator, [
      proofOfBackingMpRefUtxo,
      projectUtxo,
      projectScriptUtxo,
      protocolParamsUtxo,
    ]);

    emulator.awaitBlock(10);

    const plantParams: PlantParams = {
      protocolParamsUtxo,
      projectInfo: {
        id: projectId,
        currentMilestone: initialProjectMilestone,
        projectUtxo,
        projectScriptUtxo,
      },
      backingInfo: {
        amount: 1_000_000_000n,
        backerAddress: BACKER_ACCOUNT.address,
        backingUtxos: [],
        backingScriptAddress,
        backingScriptRefUtxo,
        proofOfBackingMpRefUtxo,
        proofOfBackingMph,
      },
    };

    let tx = plantTx(lucid, plantParams);
    tx = tx.addSigner(plantParams.backingInfo.backerAddress);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - wilted flower only", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const projectDatum: ProjectDatum = {
      projectId: { id: projectId },
      ownerAddress: constructAddress(ownerAddress),
      milestoneReached: initialProjectMilestone,
      isStakingDelegationManagedByProtocol: true,
      status: { type: "Active" },
    };

    const projectUtxo: UTxO = generateProjectUtxo(projectDatum);

    const backingUtxos = generateBackingUtxoList(10);
    const totalBackedAmount = backingUtxos.reduce(
      (total, utxo) => total + utxo.assets.lovelace,
      0n
    );
    const unbackAmount = getRandomLovelaceAmount(
      Number(totalBackedAmount - MIN_UTXO_LOVELACE)
    );

    attachUtxos(emulator, [
      proofOfBackingMpRefUtxo,
      projectUtxo,
      projectScriptUtxo,
      protocolParamsUtxo,
      ...backingUtxos,
      backingScriptRefUtxo,
    ]);

    emulator.awaitSlot(200);

    const plantParams: PlantParams = {
      protocolParamsUtxo,
      projectInfo: {
        id: projectId,
        currentMilestone: initialProjectMilestone,
        projectUtxo,
        projectScriptUtxo,
      },
      backingInfo: {
        amount: -unbackAmount,
        backerAddress: BACKER_ACCOUNT.address,
        backingUtxos,
        backingScriptAddress,
        backingScriptRefUtxo,
        proofOfBackingMpRefUtxo,
        proofOfBackingMph,
      },
    };

    let tx = plantTx(lucid, plantParams);
    tx = tx.addSigner(plantParams.backingInfo.backerAddress);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - TeikiBurntPeriodically", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const governorTeiki = 1_000_000n;
    const availableTeiki = 1_000_000_000n;

    const sharedTreasuryDatum: SharedTreasuryDatum = {
      projectId: { id: projectId },
      governorTeiki,
      projectTeiki: {
        teikiCondition: "TeikiBurntPeriodically",
        available: availableTeiki,
        lastBurnAt: { timestamp: BigInt(getTime({ lucid })) },
      },
      tag: {
        kind: "TagContinuation",
        former: constructTxOutputId(generateOutRef()),
      },
    };

    const generatedParams = generateBackingParams(
      sharedTreasuryDatum,
      projectId,
      { type: "Active" },
      governorTeiki,
      availableTeiki
    );

    const backingUtxos = generateBackingUtxoList(10);
    const totalBackedAmount = backingUtxos.reduce(
      (total, utxo) => total + utxo.assets.lovelace,
      0n
    );
    const unbackAmount = getRandomLovelaceAmount(
      Number(totalBackedAmount - MIN_UTXO_LOVELACE)
    );

    attachUtxos(emulator, backingUtxos);

    emulator.awaitBlock(20);

    const plantParams: PlantParams = {
      ...generatedParams,
      backingInfo: {
        ...generatedParams.backingInfo,
        amount: -unbackAmount,
        backingUtxos,
        backerAddress: BACKER_ACCOUNT.address,
      },
    };

    let tx = plantTx(lucid, plantParams);
    tx = tx.addSigner(plantParams.backingInfo.backerAddress);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - TeikiBurntPeriodically - wilted flower", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const governorTeiki = 1_000_000n;
    const availableTeiki = 1_000_000_000n;

    const sharedTreasuryDatum: SharedTreasuryDatum = {
      projectId: { id: projectId },
      governorTeiki,
      projectTeiki: {
        teikiCondition: "TeikiBurntPeriodically",
        available: availableTeiki,
        lastBurnAt: { timestamp: BigInt(getTime({ lucid })) },
      },
      tag: {
        kind: "TagContinuation",
        former: constructTxOutputId(generateOutRef()),
      },
    };

    const generatedParams = generateBackingParams(
      sharedTreasuryDatum,
      projectId,
      { type: "Active" },
      governorTeiki,
      availableTeiki
    );

    const backingUtxos = generateBackingUtxoList(10);
    const totalBackedAmount = backingUtxos.reduce(
      (total, utxo) => total + utxo.assets.lovelace,
      0n
    );
    const unbackAmount = getRandomLovelaceAmount(
      Number(totalBackedAmount - MIN_UTXO_LOVELACE)
    );

    attachUtxos(emulator, backingUtxos);

    emulator.awaitBlock(20);

    const plantParams: PlantParams = {
      ...generatedParams,
      backingInfo: {
        ...generatedParams.backingInfo,
        amount: -unbackAmount,
        backingUtxos,
        backerAddress: BACKER_ACCOUNT.address,
      },
    };

    let tx = plantTx(lucid, plantParams);
    tx = tx.addSigner(plantParams.backingInfo.backerAddress);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - TeikiEmpty", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const governorTeiki = 0n;
    const availableTeiki = 0n;

    const sharedTreasuryDatum: SharedTreasuryDatum = {
      projectId: { id: projectId },
      governorTeiki: 0n,
      projectTeiki: {
        teikiCondition: "TeikiEmpty",
      },
      tag: {
        kind: "TagContinuation",
        former: constructTxOutputId(generateOutRef()),
      },
    };

    const generatedParams = generateBackingParams(
      sharedTreasuryDatum,
      projectId,
      { type: "Active" },
      governorTeiki,
      availableTeiki
    );

    const backingUtxos = generateBackingUtxoList(10);
    const totalBackedAmount = backingUtxos.reduce(
      (total, utxo) => total + utxo.assets.lovelace,
      0n
    );
    const unbackAmount = getRandomLovelaceAmount(
      Number(totalBackedAmount - MIN_UTXO_LOVELACE)
    );

    attachUtxos(emulator, backingUtxos);

    emulator.awaitBlock(20);

    const plantParams: PlantParams = {
      ...generatedParams,
      backingInfo: {
        ...generatedParams.backingInfo,
        amount: -unbackAmount,
        backingUtxos,
        backerAddress: BACKER_ACCOUNT.address,
      },
    };

    let tx = plantTx(lucid, plantParams);
    tx = tx.addSigner(plantParams.backingInfo.backerAddress);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - TeikiEmpty - wilted flower", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const governorTeiki = 0n;
    const availableTeiki = 0n;

    const sharedTreasuryDatum: SharedTreasuryDatum = {
      projectId: { id: projectId },
      governorTeiki: 0n,
      projectTeiki: {
        teikiCondition: "TeikiEmpty",
      },
      tag: {
        kind: "TagContinuation",
        former: constructTxOutputId(generateOutRef()),
      },
    };

    const generatedParams = generateBackingParams(
      sharedTreasuryDatum,
      projectId,
      { type: "Active" },
      governorTeiki,
      availableTeiki
    );

    const backingUtxos = generateBackingUtxoList(10);
    const totalBackedAmount = backingUtxos.reduce(
      (total, utxo) => total + utxo.assets.lovelace,
      0n
    );
    const unbackAmount = getRandomLovelaceAmount(
      Number(totalBackedAmount - MIN_UTXO_LOVELACE)
    );

    attachUtxos(emulator, backingUtxos);

    emulator.awaitBlock(20);

    const plantParams: PlantParams = {
      ...generatedParams,
      backingInfo: {
        ...generatedParams.backingInfo,
        amount: -unbackAmount,
        backingUtxos,
        backerAddress: BACKER_ACCOUNT.address,
      },
    };

    let tx = plantTx(lucid, plantParams);
    tx = tx.addSigner(plantParams.backingInfo.backerAddress);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("clean up tx - TeikiEmpty - wilted flower", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const governorTeiki = 0n;
    const availableTeiki = 0n;

    const sharedTreasuryDatum: SharedTreasuryDatum = {
      projectId: { id: projectId },
      governorTeiki: 0n,
      projectTeiki: {
        teikiCondition: "TeikiEmpty",
      },
      tag: {
        kind: "TagContinuation",
        former: constructTxOutputId(generateOutRef()),
      },
    };

    const generatedParams = generateBackingParams(
      sharedTreasuryDatum,
      projectId,
      { type: "Delisted" },
      governorTeiki,
      availableTeiki
    );

    const backingUtxos = generateBackingUtxoList(10);
    const totalBackedAmount = backingUtxos.reduce(
      (total, utxo) => total + utxo.assets.lovelace,
      0n
    );
    const unbackAmount = getRandomLovelaceAmount(
      Number(totalBackedAmount - MIN_UTXO_LOVELACE)
    );

    attachUtxos(emulator, backingUtxos);

    emulator.awaitBlock(20);

    const plantParams = {
      ...generatedParams,
      backingInfo: {
        ...generatedParams.backingInfo,
        amount: -unbackAmount,
        backingUtxos,
        backerAddress: BACKER_ACCOUNT.address,
      },
    };

    const cleaupParams: CleanUpParams = {
      protocolParamsUtxo,
      projectInfo: plantParams.projectInfo,
      cleanUpInfo: {
        ...generatedParams.backingInfo,
        backingUtxos,
      },
      teikiMintingInfo: plantParams.teikiMintingInfo,
    };

    const tx = cleanUpTx(lucid, cleaupParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("claim teiki by flower", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const flowers = generateFlowerList(1 + Math.floor(Math.random() * 20));

    const flowerAssets: Assets = {};
    for (const flower of flowers) {
      const flowerHash = constructPlantHashUsingBlake2b(flower);
      flowerAssets[proofOfBackingMph + flowerHash] = 1n;
    }

    const backerUtxo: UTxO = {
      ...generateOutRef(),
      address: await lucid.wallet.address(),
      assets: {
        ...flowerAssets,
        lovelace: 2_000_000_000n,
      },
    };

    attachUtxos(emulator, [backerUtxo]);

    const governorTeiki = 1_000_000n;
    const availableTeiki = 1_000_000_000n;

    const sharedTreasuryDatum: SharedTreasuryDatum = {
      projectId: { id: projectId },
      governorTeiki,
      projectTeiki: {
        teikiCondition: "TeikiBurntPeriodically",
        available: availableTeiki,
        lastBurnAt: { timestamp: BigInt(getTime({ lucid })) },
      },
      tag: {
        kind: "TagContinuation",
        former: constructTxOutputId(generateOutRef()),
      },
    };

    const generatedParams = generateBackingParams(
      sharedTreasuryDatum,
      projectId,
      { type: "Active" },
      governorTeiki,
      availableTeiki
    );

    const params = {
      protocolParamsUtxo,
      projectUtxo: generatedParams.projectInfo.projectUtxo,
      backingInfo: {
        flowers,
        proofOfBackingMpRefUtxo:
          generatedParams.backingInfo.proofOfBackingMpRefUtxo,
        proofOfBackingMph: generatedParams.backingInfo.proofOfBackingMph,
      },
      teikiMintingInfo: generatedParams.teikiMintingInfo,
    };

    emulator.awaitBlock(20);

    const tx = claimRewardsByFlowerTx(lucid, params);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});

function generateBackingParams(
  sharedTreasuryDatum: SharedTreasuryDatum,
  projectId: Hex,
  projectStatus: ProjectStatus,
  governorTeiki: bigint,
  availableTeiki: bigint
) {
  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(ownerAddress),
    milestoneReached: initialProjectMilestone + 1n,
    isStakingDelegationManagedByProtocol: true,
    status: projectStatus,
  };

  const projectUtxo: UTxO = generateProjectUtxo(projectDatum);

  const sharedTreasuryUtxo: UTxO = {
    ...generateOutRef(),
    address: sharedTreasuryAddress,
    assets: {
      lovelace: MIN_UTXO_LOVELACE,
      [teikiUnit]: availableTeiki + governorTeiki,
    },
    datum: S.toCbor(S.toData(sharedTreasuryDatum, SharedTreasuryDatum)),
  };

  attachUtxos(emulator, [
    proofOfBackingMpRefUtxo,
    projectUtxo,
    projectScriptUtxo,
    protocolParamsUtxo,
    backingScriptRefUtxo,
    teikiMpRefUtxo,
    teikiPlantVRefUtxo,
    sharedTreasuryVRefUtxo,
    sharedTreasuryUtxo,
  ]);

  return {
    protocolParamsUtxo,
    projectInfo: {
      id: projectId,
      currentMilestone: projectDatum.milestoneReached,
      projectUtxo,
      projectScriptUtxo,
    },
    backingInfo: {
      backingScriptAddress,
      backingScriptRefUtxo,
      proofOfBackingMpRefUtxo,
      proofOfBackingMph,
    },
    teikiMintingInfo: {
      teikiMph,
      teikiMpRefUtxo,
      teikiPlantVRefUtxo,
      sharedTreasuryVRefUtxo,
      sharedTreasuryUtxo,
    },
  };
}

function generateProjectUtxo(projectDatum: ProjectDatum): UTxO {
  return {
    ...generateOutRef(),
    address: projectAddress,
    assets: { lovelace: MIN_UTXO_LOVELACE, [projectATUnit]: 1n },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };
}

function generateBackingUtxo() {
  const backingDatum: BackingDatum = {
    projectId: { id: projectId },
    backerAddress: constructAddress(BACKER_ACCOUNT.address),
    backedAt: { timestamp: getRandomTime() },
    milestoneBacked: initialProjectMilestone,
  };

  return {
    ...generateOutRef(),
    address: backingScriptAddress,
    assets: {
      lovelace: getRandomLovelaceAmount(),
      [proofOfBackingMph + PROOF_OF_BACKING_TOKEN_NAMES.SEED]: 1n,
    },
    datum: S.toCbor(S.toData(backingDatum, BackingDatum)),
  };
}

function generateBackingUtxoList(size: number): UTxO[] {
  return [...Array(size)].map((_) => generateBackingUtxo());
}

function generateFlower(): Plant {
  const backedAt = {
    timestamp: getRandomTime(),
  };
  const backedEpochs = Math.floor(Math.random() * 100);
  const unbackedAt = {
    timestamp:
      backedAt.timestamp +
      BigInt(
        backedEpochs * Number(protocolParamsDatum.epochLength.milliseconds)
      ),
  };
  return {
    isMatured: false,
    backingOutputId: constructTxOutputId(generateOutRef()),
    backingAmount: getRandomLovelaceAmount(),
    unbackedAt,
    projectId: { id: projectId },
    backerAddress: constructAddress(BACKER_ACCOUNT.address),
    backedAt,
    milestoneBacked: initialProjectMilestone,
  };
}

function generateFlowerList(size: number): Plant[] {
  return sortPlantByBackingOutputId(
    [...Array(size)].map((_) => generateFlower())
  );
}

function getRandomTime() {
  return BigInt(getTime({ lucid }) + Math.floor(Math.random() * 100_000));
}
