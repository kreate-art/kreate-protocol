import { Emulator, Lucid, UTxO, Unit } from "lucid-cardano";

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
import { getCurrentTime, signAndSubmit } from "@/helpers/lucid";
import {
  constructAddress,
  constructProjectIdUsingBlake2b,
  constructTxOutputId,
} from "@/helpers/schema";
import * as S from "@/schema";
import { BackingDatum } from "@/schema/teiki/backing";
import { TeikiPlantDatum } from "@/schema/teiki/meta-protocol";
import { ProjectDatum, ProjectScriptDatum } from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { SharedTreasuryDatum } from "@/schema/teiki/treasury";
import { PlantParams, plantTx } from "@/transactions/backing/plant";
import { Hex } from "@/types";

import {
  attachUtxos,
  generateAccount,
  generateScriptAddress,
  generateBlake2b224Hash,
  generateOutRef,
  generateWalletAddress,
  scriptHashToAddress,
} from "./emulator";
import { generateProtocolRegistry } from "./utils";

// NOTE: Becareful with global emulator, one test fails may lead to others fails
const BACKER_ACCOUNT = await generateAccount();
const emulator = new Emulator([BACKER_ACCOUNT]);
const lucid = await Lucid.new(emulator);

describe("backing transactions", () => {
  it("plant tx - back a project only", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const refScriptAddress = generateScriptAddress(lucid);
    const projectAddress = generateScriptAddress(lucid);
    const ownerAddress = generateWalletAddress(lucid);
    const projectScriptAddress = generateScriptAddress(lucid);
    const governorAddress = generateWalletAddress(lucid);
    const protocolParamsAddress = generateScriptAddress(lucid);

    const projectAtMph = generateBlake2b224Hash();
    const protocolNftMph = generateBlake2b224Hash();
    const teikiMph = generateBlake2b224Hash();
    const projectId = constructProjectIdUsingBlake2b(generateOutRef());
    const protocolStakeValidatorHash = generateBlake2b224Hash();

    const proofOfBackingMintingPolicy = exportScript(
      compileProofOfBackingMpScript(projectAtMph, protocolNftMph, teikiMph)
    );
    const proofOfBackingMph = lucid.utils.validatorToScriptHash(
      proofOfBackingMintingPolicy
    );

    const projectStakeValidator = exportScript(
      compileProjectSvScript(projectId, "", projectAtMph, protocolNftMph)
    );

    const backingValidator = exportScript(
      compileBackingVScript(proofOfBackingMph, protocolNftMph)
    );
    const backingValidatorHash =
      lucid.utils.validatorToScriptHash(backingValidator);

    const backingScriptAddress = scriptHashToAddress(
      lucid,
      backingValidatorHash,
      lucid.utils.validatorToScriptHash(projectStakeValidator)
    );

    const proofOfBackingMpRefUtxo: UTxO = {
      ...generateOutRef(),
      address: refScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: proofOfBackingMintingPolicy,
    };

    const projectATUnit: Unit = projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT;
    const projectScriptATUnit: Unit =
      projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

    const current_project_milestone = 0n;

    const projectDatum: ProjectDatum = {
      projectId: { id: projectId },
      ownerAddress: constructAddress(ownerAddress),
      milestoneReached: current_project_milestone,
      isStakingDelegationManagedByProtocol: true,
      status: { type: "Active" },
    };

    const projectUtxo: UTxO = {
      ...generateOutRef(),
      address: projectAddress,
      assets: { lovelace: 2_000_000n, [projectATUnit]: 1n },
      datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
    };

    const projectScriptDatum: ProjectScriptDatum = {
      projectId: { id: projectId },
      stakingKeyDeposit: 1n,
    };
    const projectScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: projectScriptAddress,
      assets: { lovelace: 2_000_000n, [projectScriptATUnit]: 1n },
      datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
      scriptRef: projectStakeValidator,
    };

    const registry = generateProtocolRegistry(protocolStakeValidatorHash, {
      backing: backingValidatorHash,
    });

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
      ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    };

    const protocolParamsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

    const protocolParamsUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolParamsAddress,
      assets: { lovelace: 2_000_000n, [protocolParamsNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
    };

    const backingScriptRefUtxo: UTxO = {
      ...generateOutRef(),
      address: refScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: backingValidator,
    };

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
        currentMilestone: current_project_milestone,
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

    const tx = plantTx(lucid, plantParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - wilted flower only", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const refScriptAddress = generateScriptAddress(lucid);
    const projectAddress = generateScriptAddress(lucid);
    const ownerAddress = generateWalletAddress(lucid);
    const projectScriptAddress = generateScriptAddress(lucid);
    const governorAddress = generateWalletAddress(lucid);
    const protocolParamsAddress = generateScriptAddress(lucid);

    const projectAtMph = generateBlake2b224Hash();
    const protocolNftMph = generateBlake2b224Hash();
    const teikiMph = generateBlake2b224Hash();
    const projectId = constructProjectIdUsingBlake2b(generateOutRef());
    const protocolStakeValidatorHash = generateBlake2b224Hash();

    const proofOfBackingMintingPolicy = exportScript(
      compileProofOfBackingMpScript(projectAtMph, protocolNftMph, teikiMph)
    );
    const proofOfBackingMph = lucid.utils.validatorToScriptHash(
      proofOfBackingMintingPolicy
    );

    const projectStakeValidator = exportScript(
      compileProjectSvScript(projectId, "", projectAtMph, protocolNftMph)
    );

    const backingValidator = exportScript(
      compileBackingVScript(proofOfBackingMph, protocolNftMph)
    );
    const backingValidatorHash =
      lucid.utils.validatorToScriptHash(backingValidator);

    const backingScriptAddress = scriptHashToAddress(
      lucid,
      backingValidatorHash,
      lucid.utils.validatorToScriptHash(projectStakeValidator)
    );

    const proofOfBackingMpRefUtxo: UTxO = {
      ...generateOutRef(),
      address: refScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: proofOfBackingMintingPolicy,
    };

    const projectATUnit: Unit = projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT;
    const projectScriptATUnit: Unit =
      projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

    const current_project_milestone = 0n;

    const projectDatum: ProjectDatum = {
      projectId: { id: projectId },
      ownerAddress: constructAddress(ownerAddress),
      milestoneReached: current_project_milestone,
      isStakingDelegationManagedByProtocol: true,
      status: { type: "Active" },
    };

    const projectUtxo: UTxO = {
      ...generateOutRef(),
      address: projectAddress,
      assets: { lovelace: 2_000_000n, [projectATUnit]: 1n },
      datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
    };

    const projectScriptDatum: ProjectScriptDatum = {
      projectId: { id: projectId },
      stakingKeyDeposit: 1n,
    };
    const projectScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: projectScriptAddress,
      assets: { lovelace: 2_000_000n, [projectScriptATUnit]: 1n },
      datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
      scriptRef: projectStakeValidator,
    };

    const registry = generateProtocolRegistry(protocolStakeValidatorHash, {
      backing: backingValidatorHash,
    });

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
      ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    };

    const protocolParamsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

    const protocolParamsUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolParamsAddress,
      assets: { lovelace: 2_000_000n, [protocolParamsNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
    };

    const backingScriptRefUtxo: UTxO = {
      ...generateOutRef(),
      address: refScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: backingValidator,
    };

    const backingDatum: BackingDatum = {
      projectId: { id: projectId },
      backerAddress: constructAddress(BACKER_ACCOUNT.address),
      stakedAt: { timestamp: BigInt(getCurrentTime(lucid)) },
      milestoneBacked: current_project_milestone,
    };

    const backingUtxo = {
      ...generateOutRef(),
      address: backingScriptAddress,
      assets: {
        lovelace: 500_000_000n,
        [proofOfBackingMph + PROOF_OF_BACKING_TOKEN_NAMES.SEED]: 1n,
      },
      datum: S.toCbor(S.toData(backingDatum, BackingDatum)),
    };

    attachUtxos(emulator, [
      proofOfBackingMpRefUtxo,
      projectUtxo,
      projectScriptUtxo,
      protocolParamsUtxo,
      backingUtxo,
      backingScriptRefUtxo,
    ]);

    emulator.awaitSlot(20);

    const plantParams: PlantParams = {
      protocolParamsUtxo,
      projectInfo: {
        id: projectId,
        currentMilestone: current_project_milestone,
        projectUtxo,
        projectScriptUtxo,
      },
      backingInfo: {
        amount: -400_000_000n,
        backerAddress: BACKER_ACCOUNT.address,
        backingUtxos: [backingUtxo],
        backingScriptAddress,
        backingScriptRefUtxo,
        proofOfBackingMpRefUtxo,
        proofOfBackingMph,
      },
    };

    const tx = plantTx(lucid, plantParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - TeikiBurntPeriodically", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const projectId = constructProjectIdUsingBlake2b(generateOutRef());
    const governorTeiki = 1_000_000n;
    const availableTeiki = 1_000_000_000n;

    const sharedTreasuryDatum: SharedTreasuryDatum = {
      projectId: { id: projectId },
      governorTeiki,
      projectTeiki: {
        teikiCondition: "TeikiBurntPeriodically",
        available: availableTeiki,
        lastBurnAt: { timestamp: BigInt(getCurrentTime(lucid)) },
      },
      tag: {
        kind: "TagContinuation",
        former: constructTxOutputId(generateOutRef()),
      },
    };

    const plantParams = generateUpdateBackingParams(
      sharedTreasuryDatum,
      projectId,
      governorTeiki,
      availableTeiki,
      20
    );

    const tx = plantTx(lucid, plantParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - TeikiBurntPeriodically - wilted flower", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const projectId = constructProjectIdUsingBlake2b(generateOutRef());
    const governorTeiki = 1_000_000n;
    const availableTeiki = 1_000_000_000n;

    const sharedTreasuryDatum: SharedTreasuryDatum = {
      projectId: { id: projectId },
      governorTeiki,
      projectTeiki: {
        teikiCondition: "TeikiBurntPeriodically",
        available: availableTeiki,
        lastBurnAt: { timestamp: BigInt(getCurrentTime(lucid)) },
      },
      tag: {
        kind: "TagContinuation",
        former: constructTxOutputId(generateOutRef()),
      },
    };

    const plantParams = generateUpdateBackingParams(
      sharedTreasuryDatum,
      projectId,
      governorTeiki,
      availableTeiki,
      8
    );

    const tx = plantTx(lucid, plantParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - TeikiEmpty", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const projectId = constructProjectIdUsingBlake2b(generateOutRef());
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

    const plantParams = generateUpdateBackingParams(
      sharedTreasuryDatum,
      projectId,
      governorTeiki,
      availableTeiki,
      20
    );

    const tx = plantTx(lucid, plantParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("plant tx - TeikiEmpty - wilted flower", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const projectId = constructProjectIdUsingBlake2b(generateOutRef());
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

    const plantParams = generateUpdateBackingParams(
      sharedTreasuryDatum,
      projectId,
      governorTeiki,
      availableTeiki,
      8
    );

    const tx = plantTx(lucid, plantParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});

// TODO: @sk-saru refine this function, backing UTxOs,
// backing amount should be generated
// benchmark
function generateUpdateBackingParams(
  sharedTreasuryDatum: SharedTreasuryDatum,
  projectId: Hex,
  governorTeiki: bigint,
  availableTeiki: bigint,
  epochs: number // after n blocks, backer could claim teiki rewards
) {
  const refScriptAddress = generateScriptAddress(lucid);
  const projectAddress = generateScriptAddress(lucid);
  const projectOwnerAddress = generateWalletAddress(lucid);
  const projectScriptAddress = generateScriptAddress(lucid);
  const governorAddress = generateScriptAddress(lucid);
  const protocolParamsAddress = generateScriptAddress(lucid);

  const projectAtMph = generateBlake2b224Hash();
  const protocolNftMph = generateBlake2b224Hash();
  const protocolStakeValidatorHash = generateBlake2b224Hash();
  const nftTeikiPlantMph = generateBlake2b224Hash();

  const teikiMintingPolicy = exportScript(
    compileTeikiMpScript(nftTeikiPlantMph)
  );
  const teikiMph = lucid.utils.validatorToScriptHash(teikiMintingPolicy);

  const proofOfBackingMintingPolicy = exportScript(
    compileProofOfBackingMpScript(projectAtMph, protocolNftMph, teikiMph)
  );
  const proofOfBackingMph = lucid.utils.validatorToScriptHash(
    proofOfBackingMintingPolicy
  );

  const backingValidator = exportScript(
    compileBackingVScript(proofOfBackingMph, protocolNftMph)
  );
  const backingValidatorHash =
    lucid.utils.validatorToScriptHash(backingValidator);

  const projectStakeValidator = exportScript(
    compileProjectSvScript(projectId, "", projectAtMph, protocolNftMph)
  );

  const proofOfBackingMpRefUtxo: UTxO = {
    ...generateOutRef(),
    address: refScriptAddress,
    assets: { lovelace: 2_000_000n },
    scriptRef: proofOfBackingMintingPolicy,
  };

  const projectATUnit: Unit = projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT;
  const projectScriptATUnit: Unit =
    projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

  const current_project_milestone = 0n;

  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(projectOwnerAddress),
    milestoneReached: current_project_milestone + 1n,
    isStakingDelegationManagedByProtocol: true,
    status: { type: "Active" },
  };

  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: { lovelace: 2_000_000n, [projectATUnit]: 1n },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };

  const projectScriptDatum: ProjectScriptDatum = {
    projectId: { id: projectId },
    stakingKeyDeposit: 1n,
  };
  const projectScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptAddress,
    assets: { lovelace: 2_000_000n, [projectScriptATUnit]: 1n },
    datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
    scriptRef: projectStakeValidator,
  };

  const backingScriptRefUtxo: UTxO = {
    ...generateOutRef(),
    address: refScriptAddress,
    assets: { lovelace: 2_000_000n },
    scriptRef: backingValidator,
  };

  const sharedTreasuryValidator = exportScript(
    compileSharedTreasuryVScript({
      projectAtMph,
      protocolNftMph,
      teikiMph,
      proofOfBackingMph,
    })
  );

  const sharedTreasuryValidatorHash = lucid.utils.validatorToScriptHash(
    sharedTreasuryValidator
  );

  const sharedTreasuryVRefUtxo: UTxO = {
    ...generateOutRef(),
    address: refScriptAddress,
    assets: { lovelace: 2_000_000n },
    scriptRef: sharedTreasuryValidator,
  };

  const sharedTreasuryAddress = scriptHashToAddress(
    lucid,
    sharedTreasuryValidatorHash
  );

  const teikiUnit: Unit = teikiMph + TEIKI_TOKEN_NAME;

  const sharedTreasuryUtxo: UTxO = {
    ...generateOutRef(),
    address: sharedTreasuryAddress,
    assets: {
      lovelace: 2_000_000n,
      [teikiUnit]: availableTeiki + governorTeiki,
    },
    datum: S.toCbor(S.toData(sharedTreasuryDatum, SharedTreasuryDatum)),
  };

  const registry = generateProtocolRegistry(protocolStakeValidatorHash, {
    backing: backingValidatorHash,
    sharedTreasury: sharedTreasuryValidatorHash,
  });

  const protocolParamsDatum: ProtocolParamsDatum = {
    registry,
    governorAddress: constructAddress(governorAddress),
    ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
  };

  const protocolParamsNftUnit: Unit =
    protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

  const protocolParamsUtxo: UTxO = {
    ...generateOutRef(),
    address: protocolParamsAddress,
    assets: { lovelace: 2_000_000n, [protocolParamsNftUnit]: 1n },
    datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
  };

  const backingScriptAddress = scriptHashToAddress(
    lucid,
    backingValidatorHash,
    lucid.utils.validatorToScriptHash(projectStakeValidator)
  );

  const backingDatum: BackingDatum = {
    projectId: { id: projectId },
    backerAddress: constructAddress(BACKER_ACCOUNT.address),
    stakedAt: { timestamp: BigInt(getCurrentTime(lucid)) },
    milestoneBacked: current_project_milestone,
  };

  const backingUtxo = {
    ...generateOutRef(),
    address: backingScriptAddress,
    assets: {
      lovelace: 500_000_000n,
      [proofOfBackingMph + PROOF_OF_BACKING_TOKEN_NAMES.SEED]: 1n,
    },
    datum: S.toCbor(S.toData(backingDatum, BackingDatum)),
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
          amounts: null,
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
      [nftTeikiPlantMph + TEIKI_PLANT_NFT_TOKEN_NAME]: 1n,
      lovelace: 10_000_000n,
    },
    datum: S.toCbor(S.toData(teikiPlantDatum, TeikiPlantDatum)),
  };

  attachUtxos(emulator, [
    proofOfBackingMpRefUtxo,
    projectUtxo,
    projectScriptUtxo,
    protocolParamsUtxo,
    backingUtxo,
    backingScriptRefUtxo,
    teikiMpRefUtxo,
    teikiPlantVRefUtxo,
    sharedTreasuryVRefUtxo,
    sharedTreasuryUtxo,
  ]);

  emulator.awaitBlock(epochs);

  return {
    protocolParamsUtxo,
    projectInfo: {
      id: projectId,
      currentMilestone: projectDatum.milestoneReached,
      projectUtxo,
      projectScriptUtxo,
    },
    backingInfo: {
      amount: -400_000_000n,
      backerAddress: BACKER_ACCOUNT.address,
      backingUtxos: [backingUtxo],
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
