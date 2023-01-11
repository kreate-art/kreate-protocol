import { Emulator, Lucid, UTxO, Unit, Data, Address } from "lucid-cardano";

import {
  compileProjectSvScript,
  compileProjectVScript,
  compileProjectDetailVScript,
  compileSharedTreasuryVScript,
  compileProjectsAtScript,
  compileDedicatedTreasuryVScript,
} from "@/commands/compile-scripts";
import { SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS } from "@/commands/generate-protocol-params";
import {
  PROJECT_AT_TOKEN_NAMES,
  PROTOCOL_NFT_TOKEN_NAMES,
} from "@/contracts/common/constants";
import { exportScript } from "@/contracts/compile";
import { signAndSubmit } from "@/helpers/lucid";
import {
  constructAddress,
  constructProjectIdUsingBlake2b,
  constructTxOutputId,
} from "@/helpers/schema";
import * as S from "@/schema";
import {
  ProjectDatum,
  ProjectDetailDatum,
  ProjectScriptDatum,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { DedicatedTreasuryDatum } from "@/schema/teiki/treasury";
import { createProjectTx } from "@/transactions/project/create";
import {
  UpdateProjectParams,
  updateProjectTx,
} from "@/transactions/project/update";
import {
  Actor,
  WithdrawFundsParams,
  withdrawFundsTx,
} from "@/transactions/project/withdraw-funds";

import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
  generateScriptAddress,
  generateWalletAddress,
} from "./emulator";
import { generateProtocolRegistry, ValidatorScriptHashRegistry } from "./utils";

const PROJECT_OWNER_ACCOUNT = await generateAccount();
const GOVERNOR_ACCOUNT = await generateAccount();
const emulator = new Emulator([PROJECT_OWNER_ACCOUNT, GOVERNOR_ACCOUNT]);
const lucid = await Lucid.new(emulator);

async function testWithdrawFunds(rewardAmount: bigint, actor: Actor) {
  lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);
  const ownerAddress = await lucid.wallet.address();

  lucid.selectWalletFromSeed(GOVERNOR_ACCOUNT.seedPhrase);
  const governorAddress = await lucid.wallet.address();

  const projectSeedOutRef = generateOutRef();
  const projectSeedTxOutputId = constructTxOutputId(projectSeedOutRef);
  const projectId = constructProjectIdUsingBlake2b(projectSeedOutRef);

  const protocolNftMph = generateBlake2b224Hash();
  const projectAtMph = generateBlake2b224Hash();
  const teikiMph = generateBlake2b224Hash();
  const proofOfBackingMph = generateBlake2b224Hash();

  const projectSvScript = exportScript(
    compileProjectSvScript(projectId, "", projectAtMph, protocolNftMph)
  );
  const projectVScript = exportScript(
    compileProjectVScript(projectAtMph, protocolNftMph)
  );
  const projectDetailVScript = exportScript(
    compileProjectDetailVScript(projectAtMph, protocolNftMph)
  );
  const dedicatedTreasuryVScript = exportScript(
    compileDedicatedTreasuryVScript(projectAtMph, protocolNftMph)
  );
  const sharedTreasuryVScript = exportScript(
    compileSharedTreasuryVScript({
      projectsAuthTokenMph: projectAtMph,
      protocolNftMph,
      teikiMph,
      proofOfBackingMph,
    })
  );

  const dedicatedTreasuryVScriptHash = lucid.utils.validatorToScriptHash(
    dedicatedTreasuryVScript
  );
  const sharedTreasuryVScriptHash = lucid.utils.validatorToScriptHash(
    sharedTreasuryVScript
  );
  const projectDetailVScriptHash =
    lucid.utils.validatorToScriptHash(projectDetailVScript);
  const projectVScriptHash = lucid.utils.validatorToScriptHash(projectVScript);
  const projectSvScriptHash =
    lucid.utils.validatorToScriptHash(projectSvScript);
  const protocolSvScriptHash = generateBlake2b224Hash();

  const projectStakeAddress =
    lucid.utils.validatorToRewardAddress(projectSvScript);
  const sharedTreasuryAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(sharedTreasuryVScriptHash),
    lucid.utils.scriptHashToCredential(protocolSvScriptHash)
  );
  const protocolParamsAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
  );
  const projectScriptAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
    lucid.utils.scriptHashToCredential(projectSvScriptHash)
  );
  const projectDetailAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(projectDetailVScriptHash)
  );
  const projectAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(projectVScriptHash)
  );
  const dedicatedTreasuryAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(dedicatedTreasuryVScriptHash)
  );
  const projectScriptDeployAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
  );
  const projectRewardAddress = lucid.utils.credentialToRewardAddress(
    lucid.utils.scriptHashToCredential(projectSvScriptHash)
  );

  const paramsNftUnit: Unit = protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;
  const projectAtUnit: Unit = projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT;
  const projectDetailAtUnit: Unit =
    projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_DETAIL;
  const projectScriptAtUnit: Unit =
    projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

  const validatorScriptHashRegistry: ValidatorScriptHashRegistry = {
    project: projectVScriptHash,
    projectDetail: projectDetailVScriptHash,
    dedicatedTreasury: dedicatedTreasuryVScriptHash,
    sharedTreasury: sharedTreasuryVScriptHash,
  };
  const registry = generateProtocolRegistry(
    protocolSvScriptHash,
    validatorScriptHashRegistry
  );
  const protocolParamsDatum: ProtocolParamsDatum = {
    registry,
    governorAddress: constructAddress(governorAddress),
    ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
  };
  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(ownerAddress),
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
    status: { type: "Active" },
  };
  const projectDetailDatum: ProjectDetailDatum = {
    projectId: { id: projectId },
    withdrawnFunds: 0n,
    sponsoredUntil: null,
    informationCid: { cid: generateBlake2b224Hash() },
    lastCommunityUpdateCid: null,
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

  const protocolParamsUtxo: UTxO = {
    ...generateOutRef(),
    address: protocolParamsAddress,
    assets: { lovelace: 2_000_000n, [paramsNftUnit]: 1n },
    datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
  };
  const projectDetailUtxo: UTxO = {
    ...generateOutRef(),
    address: projectDetailAddress,
    assets: { lovelace: 2_000_000n, [projectDetailAtUnit]: 1n },
    datum: S.toCbor(S.toData(projectDetailDatum, ProjectDetailDatum)),
  };
  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: { lovelace: 2_000_000n, [projectAtUnit]: 1n },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };
  const dedicatedTreasuryUtxo: UTxO = {
    ...generateOutRef(),
    address: dedicatedTreasuryAddress,
    assets: { lovelace: 2_000_000n },
    datum: S.toCbor(S.toData(dedicatedTreasuryDatum, DedicatedTreasuryDatum)),
  };
  const projectScriptVScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptAddress,
    assets: { lovelace: 2_000_000n, [projectScriptAtUnit]: 1n },
    scriptRef: projectSvScript,
    datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
  };
  const projectVScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptDeployAddress,
    assets: { lovelace: 2_000_000n },
    scriptRef: projectVScript,
  };
  const projectDetailVScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptDeployAddress,
    assets: { lovelace: 2_000_000n },
    scriptRef: projectDetailVScript,
  };
  const dedicatedTreasuryVScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptDeployAddress,
    assets: { lovelace: 2_000_000n },
    scriptRef: dedicatedTreasuryVScript,
  };

  attachUtxos(emulator, [
    protocolParamsUtxo,
    projectDetailVScriptUtxo,
    projectVScriptUtxo,
    projectScriptVScriptUtxo,
    dedicatedTreasuryUtxo,
    projectUtxo,
    projectDetailUtxo,
    dedicatedTreasuryVScriptUtxo,
  ]);

  const poolId = "pool1ve7vhcyde2d342wmqcwcudd906jk749t37y7fmz5e6mvgghrwh3";

  const delegateTx = await lucid
    .newTx()
    .readFrom([protocolParamsUtxo, projectScriptVScriptUtxo, projectUtxo])
    .addSigner(governorAddress)
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
    projectVScriptUtxo,
    projectDetailVScriptUtxo,
    projectScriptVScriptUtxo,
    dedicatedTreasuryVScriptUtxo,
    projectRewardAddress,
    sharedTreasuryAddress,
    totalWithdrawal: rewardAmount,
    actor,
  };

  emulator.awaitSlot(100);
  if (actor === "anyone") {
    lucid.selectWalletFromSeed(GOVERNOR_ACCOUNT.seedPhrase);
  }

  const tx = withdrawFundsTx(lucid, params);
  const txComplete = await tx.complete();
  const txHash = await signAndSubmit(txComplete);
  await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
}

describe("project transactions", () => {
  it("create project tx - with sponsor", async () => {
    expect.assertions(2);

    lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

    const ownerAddress: Address = await lucid.wallet.address();

    const seedUtxo = (await lucid.wallet.getUtxos())[0];

    expect(seedUtxo).toBeTruthy();

    const createProjectParams = generateCreateProjectParams(lucid, {
      isSponsored: true,
      seedUtxo,
      ownerAddress,
    });

    const tx = createProjectTx(lucid, createProjectParams);

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

    const createProjectParams = generateCreateProjectParams(lucid, {
      isSponsored: false,
      seedUtxo,
      ownerAddress,
    });

    const tx = createProjectTx(lucid, createProjectParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("withdraw funds tx - milestone does not reach - non-owner", async () => {
    expect.assertions(2);

    await testWithdrawFunds(900_000n, "anyone");
  });

  it("withdraw funds tx - milestone does reach - project owner", async () => {
    expect.assertions(2);

    await testWithdrawFunds(9_000_000n, "project-owner");
  });

  it("update project tx", async () => {
    expect.assertions(2);

    lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

    const ownerAddress: Address = await lucid.wallet.address();

    const seedUtxo = (await lucid.wallet.getUtxos())[0];

    expect(seedUtxo).toBeTruthy();

    const updateProjectParams = generateUpdateProjectParams(lucid, {
      isSponsored: true,
      seedUtxo,
      ownerAddress,
    });

    const tx = updateProjectTx(lucid, updateProjectParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});

type GenerateParams = {
  isSponsored: boolean;
  seedUtxo: UTxO;
  ownerAddress: Address;
};

function generateCreateProjectParams(
  lucid: Lucid,
  { isSponsored, seedUtxo, ownerAddress }: GenerateParams
) {
  const protocolStakeValidatorHash = generateBlake2b224Hash();

  const protocolParamsAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
    lucid.utils.scriptHashToCredential(protocolStakeValidatorHash)
  );

  const registry = generateProtocolRegistry(protocolStakeValidatorHash);

  const governorAddress = generateWalletAddress(lucid);

  const protocolParamsDatum: ProtocolParamsDatum = {
    registry,
    governorAddress: constructAddress(governorAddress),
    ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
  };

  const protocolNftMph = generateBlake2b224Hash();

  const paramsNftUnit: Unit = protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

  const protocolParamsUtxo: UTxO = {
    ...generateOutRef(),
    address: protocolParamsAddress,
    assets: { lovelace: 2_000_000n, [paramsNftUnit]: 1n },
    datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
  };

  const projectAtMintingPolicy = exportScript(
    compileProjectsAtScript(protocolNftMph)
  );

  const projectAtMph = lucid.utils.validatorToScriptHash(
    projectAtMintingPolicy
  );

  const projectStakeValidator = exportScript(
    compileProjectSvScript(
      constructProjectIdUsingBlake2b(seedUtxo),
      "",
      projectAtMph,
      protocolNftMph
    )
  );

  const projectScriptAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
    lucid.utils.scriptHashToCredential(
      lucid.utils.validatorToScriptHash(projectStakeValidator)
    )
  );

  const projectAtScriptRefUtxo: UTxO = {
    ...generateOutRef(),
    address: projectScriptAddress,
    assets: { lovelace: 2_000_000n },
    scriptRef: projectAtMintingPolicy,
  };

  attachUtxos(emulator, [protocolParamsUtxo, projectAtScriptRefUtxo]);

  // NOTE: When building transactions have start_time before the current time,
  // it is necessary to wait a number of slot
  emulator.awaitSlot(100);

  return {
    informationCid: { cid: "QmaMS3jikf7ZACHaGpUVD2wn3jFv1SaeVBChhkNDit5XQy" },
    isSponsored,
    ownerAddress,
    projectAtScriptRefUtxo,
    projectATPolicyId: projectAtMph,
    projectStakeValidator,
    protocolParamsUtxo,
    seedUtxo,
  };
}

function generateUpdateProjectParams(
  lucid: Lucid,
  { seedUtxo, ownerAddress }: GenerateParams
): UpdateProjectParams {
  const protocolStakeValidatorHash = generateBlake2b224Hash();

  const protocolParamsAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
    lucid.utils.scriptHashToCredential(protocolStakeValidatorHash)
  );

  const governorAddress = generateWalletAddress(lucid);

  const projectId = constructProjectIdUsingBlake2b(seedUtxo);

  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(ownerAddress),
    status: { type: "Active" },
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
  };

  const projectDetailDatum: ProjectDetailDatum = {
    projectId: { id: projectId },
    withdrawnFunds: 0n,
    sponsoredUntil: null,
    informationCid: { cid: "QmaMS3jikf86AC1aGpUVD2wn3jFv1SaeVBChhkNDit5XQy" },
    lastCommunityUpdateCid: null,
  };

  const dedicatedTreasuryDatum: DedicatedTreasuryDatum = {
    projectId: { id: projectId },
    governorAda: 0n,
    tag: { kind: "TagContinuation", former: constructTxOutputId(seedUtxo) },
  };

  const protocolNftMph = generateBlake2b224Hash();

  const paramsNftUnit: Unit = protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

  const projectAtMintingPolicy = exportScript(
    compileProjectsAtScript(protocolNftMph)
  );
  const projectAtMph = lucid.utils.validatorToScriptHash(
    projectAtMintingPolicy
  );
  const projectAtUnit: Unit = projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT;
  const projectDetailAtUnit: Unit =
    projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_DETAIL;
  const projectScriptAtUnit: Unit =
    projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

  const projectVScript = exportScript(
    compileProjectVScript(projectAtMph, protocolNftMph)
  );
  const projectDetailVScript = exportScript(
    compileProjectDetailVScript(projectAtMph, protocolNftMph)
  );
  const dedicatedTreasuryVScript = exportScript(
    compileDedicatedTreasuryVScript(projectAtMph, protocolNftMph)
  );

  const projectVScriptHash = lucid.utils.validatorToScriptHash(projectVScript);
  const projectDetailVScriptHash =
    lucid.utils.validatorToScriptHash(projectDetailVScript);
  const dedicatedTreasuryVScriptHash = lucid.utils.validatorToScriptHash(
    dedicatedTreasuryVScript
  );

  const projectAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(projectVScriptHash)
  );
  const projectDetailAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(projectDetailVScriptHash)
  );
  const dedicatedTreasuryAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(dedicatedTreasuryVScriptHash)
  );

  const registry = generateProtocolRegistry(protocolStakeValidatorHash, {
    projectDetail: projectDetailVScriptHash,
    dedicatedTreasury: dedicatedTreasuryVScriptHash,
  });

  const protocolParamsDatum: ProtocolParamsDatum = {
    registry,
    governorAddress: constructAddress(governorAddress),
    ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
  };

  const protocolParamsUtxo: UTxO = {
    ...generateOutRef(),
    address: protocolParamsAddress,
    assets: { lovelace: 2_000_000n, [paramsNftUnit]: 1n },
    datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
  };

  const projectDetailScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: generateScriptAddress(lucid),
    assets: { lovelace: 2_000_000n },
    scriptRef: projectDetailVScript,
  };

  const dedicatedTreasuryScriptUtxo: UTxO = {
    ...generateOutRef(),
    address: generateScriptAddress(lucid),
    assets: { lovelace: 2_000_000n },
    scriptRef: dedicatedTreasuryVScript,
  };

  const projectUtxo: UTxO = {
    ...generateOutRef(),
    address: projectAddress,
    assets: { lovelace: 2_000_000n, [projectAtUnit]: 1n },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
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
    assets: { lovelace: 2_000_00n, [projectScriptAtUnit]: 1n },
    datum: S.toCbor(S.toData(dedicatedTreasuryDatum, DedicatedTreasuryDatum)),
  };

  attachUtxos(emulator, [
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    dedicatedTreasuryUtxo,
    projectDetailScriptUtxo,
    dedicatedTreasuryScriptUtxo,
  ]);

  // NOTE: When building transactions have start_time before the current time,
  // it is necessary to wait a number of slot
  emulator.awaitSlot(100);

  return {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    projectDetailScriptUtxo,
    dedicatedTreasuryScriptUtxo,
    extendsSponsorship: true,
    newInformationCid: {
      cid: "QmaMS3jikf86AC1aGpUVD2wn3jFv1SaeVBChhkNDit5XQy",
    },
    newCommunityUpdateCid: {
      cid: "QmaMS3jikf86AN1aGpUVD2wn3jFv1SaeVBChhkNDit5XQy",
    },
    dedicatedTreasuryUtxo,
  };
}
