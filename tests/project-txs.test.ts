// TODO: @sk-saru refine this file please, more tests needed here
/* eslint-disable jest/max-expects */
import {
  Emulator,
  Lucid,
  UTxO,
  Unit,
  Data,
  Address,
  PoolId,
} from "lucid-cardano";

import {
  compileProjectSvScript,
  compileProjectVScript,
  compileProjectDetailVScript,
  compileSharedTreasuryVScript,
  compileProjectsAtMpScript,
  compileDedicatedTreasuryVScript,
  compileProjectScriptVScript,
  compileOpenTreasuryVScript,
} from "@/commands/compile-scripts";
import { SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS } from "@/commands/generate-protocol-params";
import {
  PROJECT_AT_TOKEN_NAMES,
  PROTOCOL_NFT_TOKEN_NAMES,
} from "@/contracts/common/constants";
import { exportScript } from "@/contracts/compile";
import { addressFromScriptHashes, signAndSubmit } from "@/helpers/lucid";
import {
  constructAddress,
  constructProjectIdUsingBlake2b,
  constructTxOutputId,
} from "@/helpers/schema";
import { getTime } from "@/helpers/time";
import * as S from "@/schema";
import {
  ProjectDatum,
  ProjectDetailDatum,
  ProjectScriptDatum,
  ProjectStatus,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import {
  DedicatedTreasuryDatum,
  OpenTreasuryDatum,
} from "@/schema/teiki/treasury";
import {
  Params as AllocateStakingParams,
  ProjectInfo,
  allocateStakingTx,
} from "@/transactions/project/allocate-staking";
import { createProjectTx } from "@/transactions/project/create";
import {
  DelegateProjectParams,
  delegateProjectTx,
} from "@/transactions/project/delegate";
import {
  Params as FinalizeCloseParams,
  finalizeCloseTx,
} from "@/transactions/project/finalize-close";
import {
  Params as InitiateCloseParams,
  initiateCloseTx,
} from "@/transactions/project/initiate-close";
import {
  UpdateProjectParams,
  updateProjectTx,
} from "@/transactions/project/update";
import {
  Params as UpdateStakingDelegationManagementParams,
  updateStakingDelegationManagement,
} from "@/transactions/project/update-staking-delegation-management";
import {
  WithdrawFundsParams,
  withdrawFundsTx,
} from "@/transactions/project/withdraw-funds";
import { Actor } from "@/types";

import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
  generateScriptAddress,
  generateStakingSeed,
} from "./emulator";
import { generateProtocolRegistry, getRandomLovelaceAmount } from "./utils";

const poolId = "pool1ve7vhcyde2d342wmqcwcudd906jk749t37y7fmz5e6mvgghrwh3";

const PROJECT_OWNER_ACCOUNT = await generateAccount();
const GOVERNOR_ACCOUNT = await generateAccount();
const STAKING_MANAGER_ACCOUNT = await generateAccount();
const ANYONE_ACCOUNT = await generateAccount();

const projectOwnerAddress = PROJECT_OWNER_ACCOUNT.address;
const governorAddress = GOVERNOR_ACCOUNT.address;
const stakingManagerAddress = STAKING_MANAGER_ACCOUNT.address;

const emulator = new Emulator([
  PROJECT_OWNER_ACCOUNT,
  GOVERNOR_ACCOUNT,
  STAKING_MANAGER_ACCOUNT,
  ANYONE_ACCOUNT,
]);
const lucid = await Lucid.new(emulator);

// Context
const protocolNftMph = generateBlake2b224Hash();
const teikiMph = generateBlake2b224Hash();
const protocolSvScriptHash = generateBlake2b224Hash();

const projectAtMintingPolicy = exportScript(
  compileProjectsAtMpScript({ protocolNftMph })
);
const projectAtMph = lucid.utils.validatorToScriptHash(projectAtMintingPolicy);

const paramsNftUnit: Unit = protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

const projectAtUnit: Unit = projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT;
const projectDetailAtUnit: Unit =
  projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_DETAIL;
const projectScriptAtUnit: Unit =
  projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

const projectVScript = exportScript(
  compileProjectVScript({ projectAtMph, protocolNftMph })
);

const projectDetailVScript = exportScript(
  compileProjectDetailVScript({ projectAtMph, protocolNftMph })
);

const projectScriptVScript = exportScript(
  compileProjectScriptVScript({ projectAtMph, protocolNftMph })
);

const dedicatedTreasuryVScript = exportScript(
  compileDedicatedTreasuryVScript({ projectAtMph, protocolNftMph })
);
const sharedTreasuryVScript = exportScript(
  compileSharedTreasuryVScript({
    projectAtMph: projectAtMph,
    protocolNftMph,
    teikiMph,
  })
);

const openTreasuryVScript = exportScript(
  compileOpenTreasuryVScript({ protocolNftMph })
);

const projectVScriptHash = lucid.utils.validatorToScriptHash(projectVScript);

const projectDetailVScriptHash =
  lucid.utils.validatorToScriptHash(projectDetailVScript);
const dedicatedTreasuryVScriptHash = lucid.utils.validatorToScriptHash(
  dedicatedTreasuryVScript
);

const projectScriptVScriptHash =
  lucid.utils.validatorToScriptHash(projectScriptVScript);

const sharedTreasuryVScriptHash = lucid.utils.validatorToScriptHash(
  sharedTreasuryVScript
);

const openTreasuryVScriptHash =
  lucid.utils.validatorToScriptHash(openTreasuryVScript);

const projectAddress = lucid.utils.credentialToAddress(
  lucid.utils.scriptHashToCredential(projectVScriptHash)
);

const projectDetailAddress = lucid.utils.credentialToAddress(
  lucid.utils.scriptHashToCredential(projectDetailVScriptHash)
);

const dedicatedTreasuryAddress = lucid.utils.credentialToAddress(
  lucid.utils.scriptHashToCredential(dedicatedTreasuryVScriptHash)
);

const sharedTreasuryAddress = lucid.utils.credentialToAddress(
  lucid.utils.scriptHashToCredential(sharedTreasuryVScriptHash),
  lucid.utils.scriptHashToCredential(protocolSvScriptHash)
);
const protocolParamsAddress = lucid.utils.credentialToAddress(
  lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
);

const registry = generateProtocolRegistry(protocolSvScriptHash, {
  project: projectVScriptHash,
  projectDetail: projectDetailVScriptHash,
  projectScript: projectScriptVScriptHash,
  dedicatedTreasury: dedicatedTreasuryVScriptHash,
  sharedTreasury: sharedTreasuryVScriptHash,
  openTreasury: openTreasuryVScriptHash,
});

const protocolParamsDatum: ProtocolParamsDatum = {
  registry,
  governorAddress: constructAddress(governorAddress),
  stakingManager: constructAddress(stakingManagerAddress).paymentCredential,
  ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
};

const protocolParamsUtxo: UTxO = {
  ...generateOutRef(),
  address: protocolParamsAddress,
  assets: { lovelace: 2_000_000n, [paramsNftUnit]: 1n },
  datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
};

const projectSeedOutRef = generateOutRef();
const projectSeedTxOutputId = constructTxOutputId(projectSeedOutRef);
const projectId = constructProjectIdUsingBlake2b(projectSeedOutRef);

const projectScriptDeployAddress = lucid.utils.credentialToAddress(
  lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
);

const projectDetailDatum: ProjectDetailDatum = {
  projectId: { id: projectId },
  withdrawnFunds: 0n,
  sponsorship: null,
  informationCid: { cid: generateBlake2b224Hash() },
  lastAnnouncementCid: null,
};
const projectScriptDatum: ProjectScriptDatum = {
  projectId: { id: projectId },
  stakingKeyDeposit: 0n,
};
const dedicatedTreasuryDatum: DedicatedTreasuryDatum = {
  projectId: { id: projectId },
  governorAda: 0n,
  tag: { kind: "TagOriginated", seed: projectSeedTxOutputId },
};

const projectDetailUtxo: UTxO = {
  ...generateOutRef(),
  address: projectDetailAddress,
  assets: { lovelace: 2_000_000n, [projectDetailAtUnit]: 1n },
  datum: S.toCbor(S.toData(projectDetailDatum, ProjectDetailDatum)),
};

const dedicatedTreasuryUtxo: UTxO = {
  ...generateOutRef(),
  address: dedicatedTreasuryAddress,
  assets: { lovelace: 2_000_000n },
  datum: S.toCbor(S.toData(dedicatedTreasuryDatum, DedicatedTreasuryDatum)),
};

const projectVRefScriptUtxo: UTxO = {
  ...generateOutRef(),
  address: projectScriptDeployAddress,
  assets: { lovelace: 2_000_000n },
  scriptRef: projectVScript,
};

const projectDetailVRefScriptUtxo: UTxO = {
  ...generateOutRef(),
  address: projectScriptDeployAddress,
  assets: { lovelace: 2_000_000n },
  scriptRef: projectDetailVScript,
};

const dedicatedTreasuryVRefScriptUtxo: UTxO = {
  ...generateOutRef(),
  address: generateScriptAddress(lucid),
  assets: { lovelace: 2_000_000n },
  scriptRef: dedicatedTreasuryVScript,
};

const openTreasuryVRefScriptUtxo: UTxO = {
  ...generateOutRef(),
  address: generateScriptAddress(lucid),
  assets: { lovelace: 2_000_000n },
  scriptRef: openTreasuryVScript,
};

const projectAtMpRefScriptUtxo: UTxO = {
  ...generateOutRef(),
  address: projectScriptDeployAddress,
  assets: { lovelace: 2_000_000n },
  scriptRef: projectAtMintingPolicy,
};

// End context

describe("project transactions", () => {
  it("create project tx - with sponsor", async () => {
    expect.assertions(2);

    lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

    const ownerAddress: Address = await lucid.wallet.address();

    const seedUtxo = (await lucid.wallet.getUtxos())[0];

    expect(seedUtxo).toBeTruthy();

    const createProjectParams = generateCreateProjectParams({
      sponsorshipAmount:
        protocolParamsDatum.projectSponsorshipMinFee +
        getRandomLovelaceAmount(),
      seedUtxo,
      ownerAddress,
    });

    let tx = createProjectTx(lucid, createProjectParams);
    tx = tx.addSigner(ownerAddress);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("create project tx - without sponsor", async () => {
    expect.assertions(2);

    lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

    const ownerAddress = await lucid.wallet.address();

    const seedUtxo = (await lucid.wallet.getUtxos())[0];

    expect(seedUtxo).toBeTruthy();

    const createProjectParams = generateCreateProjectParams({
      sponsorshipAmount: 0n,
      seedUtxo,
      ownerAddress,
    });

    let tx = createProjectTx(lucid, createProjectParams);

    tx = tx.addSigner(ownerAddress);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("withdraw funds tx - active - milestone does reach - non-owner", async () => {
    expect.assertions(2);

    const txHash = await testWithdrawFunds(9_000_000_000n, "anyone", {
      type: "Active",
    });

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("withdraw funds tx - active - milestone does not reach - project owner", async () => {
    expect.assertions(2);

    const txHash = await testWithdrawFunds(900_000n, "project-owner", {
      type: "Active",
    });

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("withdraw funds tx - active - milestone does reach - project owner", async () => {
    expect.assertions(2);

    const txHash = await testWithdrawFunds(9_000_000_000n, "project-owner", {
      type: "Active",
    });

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("update project tx - non extend sponsorship", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

    const updateProjectParams = generateUpdateProjectParams({});

    const { tx } = updateProjectTx(lucid, updateProjectParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("update project tx - extend sponsorship", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

    const updateProjectParams = generateUpdateProjectParams({
      sponsorshipAmount:
        protocolParamsDatum.projectSponsorshipMinFee +
        getRandomLovelaceAmount(),
    });

    const { tx } = updateProjectTx(lucid, updateProjectParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("delegate project tx", async () => {
    expect.assertions(2);

    // EUSKL pool
    await testDelegateProject(
      "pool1l5u4zh84na80xr56d342d32rsdw62qycwaw97hy9wwsc6axdwla"
    );
  });

  it("initiate close project tx", async () => {
    expect.assertions(1);
    await testInitiateCloseProjectTx();
  });

  it("finalize close project tx - close immediately - not consume open treasury", async () => {
    expect.assertions(2);

    await testFinalizeCloseProject({ rewardAmount: getRandomLovelaceAmount() });
  });

  it("finalize close project tx - close immediately - consume open treasury", async () => {
    expect.assertions(2);

    await testFinalizeCloseProject({ rewardAmount: 1_000_000n });
  });

  it("allocate staking validator tx - any one", async () => {
    expect.assertions(1);
    await testAllocateStaking("anyone");
  });

  it("allocate staking validator tx - project owner", async () => {
    expect.assertions(1);
    await testAllocateStaking("project-owner");
  });

  it("allocate staking validator tx - staking manager", async () => {
    expect.assertions(1);
    await testAllocateStaking("staking-manager");
  });

  it("allocate staking validator tx - protocol governor", async () => {
    expect.assertions(1);
    await testAllocateStaking("protocol-governor");
  });

  it("update staking delegation management tx - project owner", async () => {
    expect.assertions(1);
    await testUpdateStakingDelegationManagementTx();
  });
});

async function testInitiateCloseProjectTx() {
  lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(projectOwnerAddress),
    status: { type: "Active" },
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
  };

  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: {
      lovelace:
        SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS.projectPledge +
        getRandomLovelaceAmount(),
      [projectAtUnit]: 1n,
    },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };

  attachUtxos(emulator, [
    protocolParamsUtxo,
    projectUtxo,
    projectVRefScriptUtxo,
  ]);

  emulator.awaitBlock(10);

  const time = getTime({ lucid });

  const params: InitiateCloseParams = {
    protocolParamsUtxo,
    projectUtxo,
    projectVRefScriptUtxo,
    scheduledClosingTime: time + 8_640_000,
  };

  const tx = initiateCloseTx(lucid, params).addSigner(projectOwnerAddress);
  const txComplete = await tx.complete();
  const txHash = await signAndSubmit(txComplete);
  await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
}

async function testUpdateStakingDelegationManagementTx() {
  lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(projectOwnerAddress),
    status: { type: "Active" },
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
  };

  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: {
      lovelace:
        SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS.projectPledge +
        getRandomLovelaceAmount(),
      [projectAtUnit]: 1n,
    },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };

  attachUtxos(emulator, [
    protocolParamsUtxo,
    projectUtxo,
    projectVRefScriptUtxo,
  ]);

  emulator.awaitBlock(10);

  const params: UpdateStakingDelegationManagementParams = {
    protocolParamsUtxo,
    projectUtxo,
    projectVRefScriptUtxo,
  };

  const tx = updateStakingDelegationManagement(lucid, params).addSigner(
    PROJECT_OWNER_ACCOUNT.address
  );
  const txComplete = await tx.complete();
  const txHash = await signAndSubmit(txComplete);
  await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
}

async function testAllocateStaking(actor: Actor) {
  let signerAddress: Address;

  switch (actor) {
    case "anyone":
      lucid.selectWalletFromSeed(ANYONE_ACCOUNT.seedPhrase);
      signerAddress = ANYONE_ACCOUNT.address;
      break;
    case "project-owner":
      lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);
      signerAddress = PROJECT_OWNER_ACCOUNT.address;
      break;
    case "staking-manager":
      lucid.selectWalletFromSeed(STAKING_MANAGER_ACCOUNT.seedPhrase);
      signerAddress = STAKING_MANAGER_ACCOUNT.address;
      break;
    case "protocol-governor":
      lucid.selectWalletFromSeed(GOVERNOR_ACCOUNT.seedPhrase);
      signerAddress = GOVERNOR_ACCOUNT.address;
      break;
  }

  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(projectOwnerAddress),
    status: { type: "Active" },
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
  };

  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: {
      lovelace:
        SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS.projectPledge +
        getRandomLovelaceAmount(),
      [projectAtUnit]: 1n,
    },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };

  const newStakeValidator = exportScript(
    compileProjectSvScript({
      projectId,
      stakingSeed: generateStakingSeed(),
      projectAtMph,
      protocolNftMph,
    })
  );

  const projectInfo: ProjectInfo = {
    projectUtxo,
    newStakeValidator,
  };

  attachUtxos(emulator, [
    protocolParamsUtxo,
    projectInfo.projectUtxo,
    projectVRefScriptUtxo,
    projectAtMpRefScriptUtxo,
  ]);

  emulator.awaitBlock(10);

  const params: AllocateStakingParams = {
    protocolParamsUtxo,
    projectInfoList: [projectInfo],
    projectVRefScriptUtxo,
    projectAtMpRefScriptUtxo,
  };

  const tx = allocateStakingTx(lucid, params).addSigner(signerAddress);
  if (actor === "anyone") {
    await expect(tx.complete()).rejects.toContain(
      "The provided Plutus code called 'error'"
    );
  } else {
    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);
    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  }
}

type GenerateParams = {
  sponsorshipAmount: bigint;
  seedUtxo: UTxO;
  ownerAddress: Address;
};

function generateCreateProjectParams({
  sponsorshipAmount,
  seedUtxo,
  ownerAddress,
}: GenerateParams) {
  const projectSvScript = exportScript(
    compileProjectSvScript({
      projectId: constructProjectIdUsingBlake2b(seedUtxo),
      stakingSeed: generateStakingSeed(),
      projectAtMph,
      protocolNftMph,
    })
  );

  attachUtxos(emulator, [protocolParamsUtxo, projectAtMpRefScriptUtxo]);

  // NOTE: When building transactions have start_time before the current time,
  // it is necessary to wait a number of slot
  emulator.awaitSlot(100);

  return {
    informationCid: { cid: "QmaMS3jikf7ZACHaGpUVD2wn3jFv1SaeVBChhkNDit5XQy" },
    sponsorshipAmount,
    ownerAddress,
    projectAtScriptRefUtxo: projectAtMpRefScriptUtxo,
    projectATPolicyId: projectAtMph,
    projectStakeValidator: projectSvScript,
    protocolParamsUtxo,
    seedUtxo,
  };
}

function generateUpdateProjectParams({
  sponsorshipAmount,
}: {
  sponsorshipAmount?: bigint;
}): UpdateProjectParams {
  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(projectOwnerAddress),
    status: { type: "Active" },
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
  };

  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: { lovelace: 2_000_000n, [projectAtUnit]: 1n },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };

  attachUtxos(emulator, [
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    dedicatedTreasuryUtxo,
    projectDetailVRefScriptUtxo,
    dedicatedTreasuryVRefScriptUtxo,
  ]);

  // NOTE: When building transactions have start_time before the current time,
  // it is necessary to wait a number of slot
  emulator.awaitSlot(100);

  return {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    projectDetailVRefScriptUtxo,
    dedicatedTreasuryVRefScriptUtxo,
    newSponsorshipAmount: sponsorshipAmount,
    newInformationCid: {
      cid: "QmaMS3jikf86AC1aGpUVD2wn3jFv1SaeVBChhkNDit5XQy",
    },
    newAnnouncementCid: {
      cid: "QmaMS3jikf86AN1aGpUVD2wn3jFv1SaeVBChhkNDit5XQy",
    },
    dedicatedTreasuryUtxo,
  };
}

async function testWithdrawFunds(
  rewardAmount: bigint,
  actor: Actor,
  projectStatus: ProjectStatus
) {
  const projectSvScript = exportScript(
    compileProjectSvScript({
      projectId,
      stakingSeed: generateStakingSeed(),
      projectAtMph,
      protocolNftMph,
    })
  );

  const projectSvScriptHash =
    lucid.utils.validatorToScriptHash(projectSvScript);

  const projectStakeAddress =
    lucid.utils.validatorToRewardAddress(projectSvScript);

  const projectScriptAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(projectScriptVScriptHash),
    lucid.utils.scriptHashToCredential(projectSvScriptHash)
  );

  const projectScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptAddress,
    assets: { lovelace: 2_000_000n, [projectScriptAtUnit]: 1n },
    scriptRef: projectSvScript,
    datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
  };

  const projectRewardAddress = lucid.utils.credentialToRewardAddress(
    lucid.utils.scriptHashToCredential(projectSvScriptHash)
  );

  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(projectOwnerAddress),
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
    status: projectStatus,
  };

  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: { lovelace: 2_000_000n, [projectAtUnit]: 1n },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };

  attachUtxos(emulator, [
    protocolParamsUtxo,
    projectDetailVRefScriptUtxo,
    projectVRefScriptUtxo,
    projectScriptUtxo,
    dedicatedTreasuryUtxo,
    projectUtxo,
    projectDetailUtxo,
    dedicatedTreasuryVRefScriptUtxo,
  ]);

  lucid.selectWalletFromSeed(STAKING_MANAGER_ACCOUNT.seedPhrase);

  const delegateTx = await lucid
    .newTx()
    .readFrom([protocolParamsUtxo, projectScriptUtxo, projectUtxo])
    .addSigner(stakingManagerAddress)
    .registerStake(projectStakeAddress)
    .delegateTo(projectStakeAddress, poolId, Data.void())
    .complete();

  const delegateTxHash = await signAndSubmit(delegateTx);
  await expect(lucid.awaitTx(delegateTxHash)).resolves.toBe(true);

  emulator.distributeRewards(rewardAmount);

  const params: WithdrawFundsParams = {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    dedicatedTreasuryUtxo,
    projectVRefScriptUtxo,
    projectDetailVRefScriptUtxo,
    projectScriptUtxos: [projectScriptUtxo],
    rewardAddressAndAmount: [[projectRewardAddress, rewardAmount]],
    dedicatedTreasuryVRefScriptUtxo,
    sharedTreasuryAddress,
    actor,
  };

  emulator.awaitSlot(100);

  switch (actor) {
    case "anyone":
      lucid.selectWalletFromSeed(ANYONE_ACCOUNT.seedPhrase);
      break;
    case "project-owner":
      lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);
      break;
  }

  const tx = withdrawFundsTx(lucid, params);
  const txComplete = await tx.complete();
  const txHash = await signAndSubmit(txComplete);
  return txHash;
}

async function testDelegateProject(poolId: PoolId) {
  lucid.selectWalletFromSeed(STAKING_MANAGER_ACCOUNT.seedPhrase);

  const projectSvScript = exportScript(
    compileProjectSvScript({
      projectId,
      stakingSeed: generateStakingSeed(),
      projectAtMph,
      protocolNftMph,
    })
  );

  const projectSvScriptHash =
    lucid.utils.validatorToScriptHash(projectSvScript);

  const projectScriptAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
    lucid.utils.scriptHashToCredential(projectSvScriptHash)
  );

  const projectScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptAddress,
    assets: { lovelace: 2_000_000n, [projectScriptAtUnit]: 1n },
    scriptRef: projectSvScript,
    datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
  };

  const projectRewardAddress = lucid.utils.credentialToRewardAddress(
    lucid.utils.scriptHashToCredential(projectSvScriptHash)
  );

  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(projectOwnerAddress),
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
    status: { type: "Active" },
  };

  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: { lovelace: 2_000_000n, [projectAtUnit]: 1n },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };

  // Formally, the project's staking credential is registered when creating project
  const registerTx = await lucid
    .newTx()
    .registerStake(projectRewardAddress)
    .complete();
  const registerTxHash = await signAndSubmit(registerTx);
  await expect(lucid.awaitTx(registerTxHash)).resolves.toBe(true);

  const params: DelegateProjectParams = {
    protocolParamsUtxo,
    authorizedAddress: STAKING_MANAGER_ACCOUNT.address,
    allDelegatedProjects: [
      {
        projectUtxo,
        projectScriptUtxo,
      },
    ],
    poolId,
  };

  attachUtxos(emulator, [protocolParamsUtxo, projectScriptUtxo, projectUtxo]);

  const tx = delegateProjectTx(lucid, params);
  const txComplete = await tx.complete();
  const txHash = await signAndSubmit(txComplete);
  await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
}

async function testFinalizeCloseProject({
  rewardAmount,
}: {
  rewardAmount: bigint;
}) {
  const projectSvScript = exportScript(
    compileProjectSvScript({
      projectId,
      stakingSeed: generateStakingSeed(),
      projectAtMph,
      protocolNftMph,
    })
  );

  const projectSvScriptHash =
    lucid.utils.validatorToScriptHash(projectSvScript);

  const projectStakeAddress =
    lucid.utils.validatorToRewardAddress(projectSvScript);

  const projectScriptAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(projectScriptVScriptHash),
    lucid.utils.scriptHashToCredential(projectSvScriptHash)
  );

  const projectScriptVRefScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptAddress,
    assets: { lovelace: 2_000_000n, [projectScriptAtUnit]: 1n },
    scriptRef: projectScriptVScript,
    datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
  };

  const projectScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptAddress,
    assets: { lovelace: 200_000_000n, [projectScriptAtUnit]: 1n },
    datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
    scriptRef: projectSvScript,
  };

  lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);
  const ownerAddress = await lucid.wallet.address();

  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(ownerAddress),
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
    status: { type: "Active" },
  };

  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: { lovelace: 2_000_000n, [projectAtUnit]: 1n },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };

  const openTreasuryDatum: OpenTreasuryDatum = {
    governorAda: getRandomLovelaceAmount(),
    tag: {
      kind: "TagProjectDelayedStakingRewards",
      stakingValidator: null,
    },
  };

  const openTreasuryScriptAddress = addressFromScriptHashes(
    lucid,
    protocolParamsDatum.registry.openTreasuryValidator.latest.script.hash,
    protocolParamsDatum.registry.protocolStakingValidator.script.hash
  );

  const openTreasuryUtxo: UTxO = {
    ...generateOutRef(),
    address: openTreasuryScriptAddress,
    assets: {
      lovelace: openTreasuryDatum.governorAda + getRandomLovelaceAmount(),
    },
    datum: S.toCbor(S.toData(openTreasuryDatum, OpenTreasuryDatum)),
  };

  const params: FinalizeCloseParams = {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    projectVRefScriptUtxo,
    projectDetailVRefScriptUtxo,
    projectScriptVRefScriptUtxo,
    projectScriptInfoList: [{ projectScriptUtxo, rewardAmount }],
    openTreasuryInfo: {
      openTreasuryUtxo,
      openTreasuryVRefScriptUtxo,
    },
    projectAtPolicyId: projectAtMph,
    projectAtScriptUtxo: projectAtMpRefScriptUtxo,
  };

  attachUtxos(emulator, [
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    projectVRefScriptUtxo,
    projectDetailVRefScriptUtxo,
    projectScriptVRefScriptUtxo,
    projectScriptUtxo,
    projectAtMpRefScriptUtxo,
    openTreasuryUtxo,
    openTreasuryVRefScriptUtxo,
  ]);

  lucid.selectWalletFromSeed(STAKING_MANAGER_ACCOUNT.seedPhrase);

  const delegateTx = await lucid
    .newTx()
    .readFrom([protocolParamsUtxo, projectUtxo, projectScriptUtxo])
    .addSigner(stakingManagerAddress)
    .registerStake(projectStakeAddress)
    .delegateTo(projectStakeAddress, poolId, Data.void())
    .complete();

  const delegateTxHash = await signAndSubmit(delegateTx);
  await expect(lucid.awaitTx(delegateTxHash)).resolves.toBe(true);

  lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

  emulator.distributeRewards(rewardAmount);
  emulator.awaitBlock(100);

  const tx = finalizeCloseTx(lucid, params);
  const txComplete = await tx.complete();
  const txHash = await signAndSubmit(txComplete);

  await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
}
