import { Emulator, Lucid, UTxO, Unit } from "lucid-cardano";

import { compileDedicatedTreasuryVScript } from "@/commands/compile-scripts";
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
import { ProjectDatum } from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { DedicatedTreasuryDatum } from "@/schema/teiki/treasury";
import { TREASURY_MIN_WITHDRAWAL_ADA } from "@/transactions/constants";
import {
  Params as RevokeParams,
  revokeTx,
} from "@/transactions/treasury/dedicated-treasury/revoke";
import {
  Params as WithdrawAdaParams,
  withdrawAdaTx,
} from "@/transactions/treasury/dedicated-treasury/withdraw-ada";
import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
  generateScriptAddress,
  generateWalletAddress,
  scriptHashToAddress,
} from "tests/emulator";
import {
  MIN_UTXO_LOVELACE,
  generateProtocolRegistry,
  getRandomLovelaceAmount,
} from "tests/utils";

const GOVERNOR_ACCOUNT = await generateAccount();
const ANYONE_ACCOUNT = await generateAccount();
const emulator = new Emulator([GOVERNOR_ACCOUNT, ANYONE_ACCOUNT]);
const lucid = await Lucid.new(emulator);

// context
const protocolNftMph = generateBlake2b224Hash();
const projectAtMph = generateBlake2b224Hash();
const protocolSvHash = generateBlake2b224Hash();
const refScriptAddress = generateScriptAddress(lucid);

const projectId = constructProjectIdUsingBlake2b(generateOutRef());

const stakingManagerAddress = generateWalletAddress(lucid);
const protocolParamsAddress = generateScriptAddress(lucid);

const dedicatedTreasuryVScript = exportScript(
  compileDedicatedTreasuryVScript({ protocolNftMph, projectAtMph })
);

const dedicatedTreasuryVScriptHash = lucid.utils.validatorToScriptHash(
  dedicatedTreasuryVScript
);

const dedicatedTreasuryVScriptAddress = scriptHashToAddress(
  lucid,
  dedicatedTreasuryVScriptHash
);

const dedicatedTreasuryVRefScriptUtxo: UTxO = {
  ...generateOutRef(),
  address: refScriptAddress,
  assets: { lovelace: MIN_UTXO_LOVELACE },
  scriptRef: dedicatedTreasuryVScript,
};

const projectATUnit: Unit = projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT;
const projectAddress = generateScriptAddress(lucid);
const ownerAddress = generateWalletAddress(lucid);

const projectDatum: ProjectDatum = {
  projectId: { id: projectId },
  ownerAddress: constructAddress(ownerAddress),
  milestoneReached: 0n,
  isStakingDelegationManagedByProtocol: true,
  status: { type: "Active" },
};

const projectUtxo: UTxO = generateProjectUtxo(projectDatum);

const registry = generateProtocolRegistry(protocolSvHash, {
  dedicatedTreasury: dedicatedTreasuryVScriptHash,
});

const protocolParamsDatum: ProtocolParamsDatum = {
  registry,
  governorAddress: constructAddress(GOVERNOR_ACCOUNT.address),
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

describe("dedicated treasury transactions", () => {
  it("withdraw ADA tx - protocol-governor", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(GOVERNOR_ACCOUNT.seedPhrase);

    const dedicatedTreasuryUtxos = generateDedicatedTreasuryUtxoList(10);
    attachUtxos(emulator, [
      protocolParamsUtxo,
      projectUtxo,
      dedicatedTreasuryVRefScriptUtxo,
      ...dedicatedTreasuryUtxos,
    ]);

    const params: WithdrawAdaParams = {
      protocolParamsUtxo,
      projectUtxo,
      dedicatedTreasuryUtxos,
      dedicatedTreasuryVRefScriptUtxo,
      actor: "protocol-governor",
    };

    emulator.awaitBlock(10);

    const tx = withdrawAdaTx(lucid, params);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("withdraw ADA tx - any one", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(GOVERNOR_ACCOUNT.seedPhrase);

    const dedicatedTreasuryUtxos = generateDedicatedTreasuryUtxoList(5);
    attachUtxos(emulator, [
      protocolParamsUtxo,
      projectUtxo,
      dedicatedTreasuryVRefScriptUtxo,
      ...dedicatedTreasuryUtxos,
    ]);

    const params: WithdrawAdaParams = {
      protocolParamsUtxo,
      projectUtxo,
      dedicatedTreasuryUtxos,
      dedicatedTreasuryVRefScriptUtxo,
      actor: "anyone",
    };

    emulator.awaitBlock(10);

    const tx = withdrawAdaTx(lucid, params);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("revoke tx - closed project", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(GOVERNOR_ACCOUNT.seedPhrase);

    const dedicatedTreasuryUtxos = generateDedicatedTreasuryUtxoList(5);

    const closedProjectDatum: ProjectDatum = {
      projectId: { id: projectId },
      ownerAddress: constructAddress(ownerAddress),
      milestoneReached: 0n,
      isStakingDelegationManagedByProtocol: true,
      status: { type: "Closed" },
    };

    const closedProjectUtxo: UTxO = generateProjectUtxo(closedProjectDatum);

    attachUtxos(emulator, [
      protocolParamsUtxo,
      closedProjectUtxo,
      dedicatedTreasuryVRefScriptUtxo,
      ...dedicatedTreasuryUtxos,
    ]);

    const params: RevokeParams = {
      protocolParamsUtxo,
      projectUtxo: closedProjectUtxo,
      dedicatedTreasuryUtxos,
      dedicatedTreasuryVRefScriptUtxo,
    };

    emulator.awaitBlock(10);

    const tx = revokeTx(lucid, params);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("revoke tx - delisted project", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(GOVERNOR_ACCOUNT.seedPhrase);

    const dedicatedTreasuryUtxos = generateDedicatedTreasuryUtxoList(5);

    const delistedProjectDatum: ProjectDatum = {
      projectId: { id: projectId },
      ownerAddress: constructAddress(ownerAddress),
      milestoneReached: 0n,
      isStakingDelegationManagedByProtocol: true,
      status: { type: "Delisted" },
    };

    const delistedProjectUtxo: UTxO = generateProjectUtxo(delistedProjectDatum);

    attachUtxos(emulator, [
      protocolParamsUtxo,
      delistedProjectUtxo,
      dedicatedTreasuryVRefScriptUtxo,
      ...dedicatedTreasuryUtxos,
    ]);

    const params: RevokeParams = {
      protocolParamsUtxo,
      projectUtxo: delistedProjectUtxo,
      dedicatedTreasuryUtxos,
      dedicatedTreasuryVRefScriptUtxo,
    };

    emulator.awaitBlock(10);

    const tx = revokeTx(lucid, params);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});

function generateDedicatedTreasuryUtxo() {
  const datum: DedicatedTreasuryDatum = {
    projectId: { id: projectId },
    governorAda: TREASURY_MIN_WITHDRAWAL_ADA + getRandomLovelaceAmount(),
    tag: {
      kind: "TagContinuation",
      former: constructTxOutputId(generateOutRef()),
    },
  };

  return {
    ...generateOutRef(),
    address: dedicatedTreasuryVScriptAddress,
    assets: {
      lovelace: datum.governorAda + getRandomLovelaceAmount(),
    },
    datum: S.toCbor(S.toData(datum, DedicatedTreasuryDatum)),
  };
}

function generateDedicatedTreasuryUtxoList(size: number): UTxO[] {
  return [...Array(size)].map((_) => generateDedicatedTreasuryUtxo());
}

function generateProjectUtxo(projectDatum: ProjectDatum): UTxO {
  return {
    ...generateOutRef(),
    address: projectAddress,
    assets: { lovelace: MIN_UTXO_LOVELACE, [projectATUnit]: 1n },
    datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
  };
}
