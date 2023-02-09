import { Address, Lucid, Tx, UTxO } from "lucid-cardano";

import { PROOF_OF_BACKING_TOKEN_NAMES } from "@/contracts/common/constants";
import {
  constructAddress,
  constructPlantHashUsingBlake2b,
  constructTxOutputId,
  parseProtocolParams,
} from "@/helpers/schema";
import { getTime, TimeProvider } from "@/helpers/time";
import * as S from "@/schema";
import {
  BackingDatum,
  BackingRedeemer,
  Plant,
  ProofOfBackingMintingRedeemer,
} from "@/schema/teiki/backing";
import { ProjectDatum } from "@/schema/teiki/project";
import { Hex, TimeDifference } from "@/types";
import { assert } from "@/utils";

import { attachTeikiNftMetadata, getPlantNftName } from "../meta-data";

import { mintTeiki } from "./utils";

export type ProjectInfo = {
  id: Hex;
  currentMilestone: bigint;
  projectUtxo: UTxO;
  projectScriptUtxo?: UTxO;
};

export type BackingInfo = {
  // negative for unbacking
  // positive for backing
  amount: bigint;
  backerAddress: Address;
  backingUtxos: UTxO[];
  backingScriptAddress?: Address;
  backingScriptRefUtxo: UTxO;
  proofOfBackingMpRefUtxo: UTxO;
  proofOfBackingMph: Hex;
};

export type TeikiMintingInfo = {
  teikiMph: Hex;
  teikiMpRefUtxo: UTxO;
  teikiPlantVRefUtxo: UTxO;
  sharedTreasuryVRefUtxo: UTxO;
  sharedTreasuryUtxo: UTxO;
};

export type PlantParams = {
  protocolParamsUtxo: UTxO;
  projectInfo: ProjectInfo;
  backingInfo: BackingInfo;
  teikiMintingInfo?: TeikiMintingInfo;
  txTimeStartPadding?: TimeDifference;
  txTimeEndPadding?: TimeDifference;
  timeProvider?: TimeProvider;
};

// clean up is splitted to another transaction
export function plantTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectInfo,
    backingInfo,
    teikiMintingInfo,
    txTimeStartPadding = 20_000,
    txTimeEndPadding = 60_000,
    timeProvider,
  }: PlantParams
) {
  const proofOfBackingMpRefUtxo = backingInfo.proofOfBackingMpRefUtxo;

  assert(
    proofOfBackingMpRefUtxo.scriptRef != null,
    "Invalid proof of backing reference UTxO: must reference proof of backing script"
  );

  const proofOfBackingMintingRedeemer = S.toCbor(
    S.toData({ case: "Plant", cleanup: false }, ProofOfBackingMintingRedeemer)
  );

  const now = getTime({ timeProvider, lucid });
  const txTimeStart = now - txTimeStartPadding;
  const txTimeEnd = now + txTimeEndPadding;

  const totalBackingAmount = backingInfo.backingUtxos.reduce(
    (acc, backingUtxo) => acc + BigInt(backingUtxo.assets.lovelace),
    0n
  );

  const remainBackingAmount = totalBackingAmount + backingInfo.amount;

  assert(
    remainBackingAmount >= 0n,
    "Current backing amount does not cover the unbacking amount"
  );

  let tx = lucid
    .newTx()
    .readFrom([
      proofOfBackingMpRefUtxo,
      projectInfo.projectUtxo,
      protocolParamsUtxo,
    ])
    .validFrom(txTimeStart)
    .validTo(txTimeEnd);

  // NOTE: We may only need to produce multiple backing UTxOs in case of cleanup
  const numProducedBackingUtxos = remainBackingAmount === 0n ? 0 : 1;
  if (numProducedBackingUtxos) {
    assert(
      projectInfo.projectScriptUtxo?.scriptRef,
      "Invalid parameters: Missing project script UTxO"
    );

    tx = tx.readFrom([projectInfo.projectScriptUtxo]);
  }

  const seedTokenMintAmount =
    numProducedBackingUtxos - backingInfo.backingUtxos.length;

  const seedUnit =
    backingInfo.proofOfBackingMph + PROOF_OF_BACKING_TOKEN_NAMES.SEED;

  if (seedTokenMintAmount !== 0) {
    tx = tx.mintAssets(
      { [seedUnit]: BigInt(seedTokenMintAmount) },
      proofOfBackingMintingRedeemer
    );
  }

  // TODO: @sk-saru Check whether the backer unback or not
  if (backingInfo.amount <= 0n) {
    tx = addCollectBackingInstruction(tx, backingInfo);

    tx = addMintingInstruction(tx, {
      backingInfo,
      protocolParamsUtxo,
      projectUtxo: projectInfo.projectUtxo,
      teikiMintingInfo,
      txTimeStart,
      proofOfBackingMintingRedeemer,
    });
  }

  // Check whether a new backing UTxO should be produced
  if (remainBackingAmount > 0n) {
    assert(
      backingInfo.backingScriptAddress,
      "Invalid parameters: Missing backing script address"
    );

    const backingDatum: BackingDatum = {
      projectId: { id: projectInfo.id },
      backerAddress: constructAddress(backingInfo.backerAddress),
      backedAt: { timestamp: BigInt(txTimeStart) },
      milestoneBacked: projectInfo.currentMilestone,
    };

    tx = tx.payToContract(
      backingInfo.backingScriptAddress,
      { inline: S.toCbor(S.toData(backingDatum, BackingDatum)) },
      { [seedUnit]: 1n, lovelace: remainBackingAmount }
    );
  }

  return tx;
}

function addCollectBackingInstruction(tx: Tx, backingInfo: BackingInfo) {
  return tx
    .readFrom([backingInfo.backingScriptRefUtxo])
    .collectFrom(
      backingInfo.backingUtxos,
      S.toCbor(S.toData({ case: "Unback" }, BackingRedeemer))
    );
}

type MintingInstructionParams = {
  backingInfo: BackingInfo;
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  teikiMintingInfo?: TeikiMintingInfo;
  txTimeStart: number;
  proofOfBackingMintingRedeemer: Hex;
};

function addMintingInstruction(
  tx: Tx,
  {
    backingInfo,
    protocolParamsUtxo,
    projectUtxo,
    teikiMintingInfo,
    txTimeStart,
    proofOfBackingMintingRedeemer,
  }: MintingInstructionParams
) {
  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );

  assert(
    projectUtxo.datum != null,
    "Invalid project UTxO: Missing inline datum"
  );

  assert(
    backingInfo.backingScriptRefUtxo,
    "Missing backing validator reference script UTxO"
  );

  const { protocolParams } = parseProtocolParams(
    S.fromCbor(protocolParamsUtxo.datum)
  );

  const projectDatum = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  const unbackedAt = txTimeStart;
  let totalTeikiRewards = 0n;
  let wiltedFlowerMintAmount = 0n;

  for (const backingUtxo of backingInfo.backingUtxos) {
    assert(
      backingUtxo.datum != null,
      "Invalid backing UTxO: Missing inline datum"
    );

    const backingDatum = S.fromData(
      S.fromCbor(backingUtxo.datum),
      BackingDatum
    );

    const timePassed = BigInt(unbackedAt) - backingDatum.backedAt.timestamp;

    if (timePassed < 0n) throw new Error("Invalid unbacking time");
    if (timePassed >= protocolParams.epochLength.milliseconds) {
      const backingAmount = BigInt(backingUtxo.assets.lovelace);

      const isMatured =
        backingDatum.milestoneBacked < projectDatum.milestoneReached &&
        projectDatum.status.type !== "PreDelisted";

      const plant: Plant = {
        isMatured,
        backingOutputId: constructTxOutputId(backingUtxo),
        backingAmount,
        unbackedAt: { timestamp: BigInt(unbackedAt) },
        ...backingDatum,
      };

      const plantHash = constructPlantHashUsingBlake2b(plant);

      tx = tx.mintAssets(
        { [backingInfo.proofOfBackingMph + plantHash]: 1n },
        proofOfBackingMintingRedeemer
      );

      tx = attachTeikiNftMetadata(tx, {
        policyId: backingInfo.proofOfBackingMph,
        assetName: plantHash,
        nftName: getPlantNftName({ isMatured }),
        projectId: backingDatum.projectId.id,
        backingAmount,
        duration: timePassed,
      });

      const teikiRewards = isMatured
        ? (backingAmount *
            BigInt(BigInt(unbackedAt) - backingDatum.backedAt.timestamp)) /
          BigInt(protocolParams.epochLength.milliseconds) /
          protocolParams.teikiCoefficient
        : 0n;

      totalTeikiRewards += teikiRewards;
    } else {
      wiltedFlowerMintAmount += 1n;
    }
  }

  if (wiltedFlowerMintAmount > 0n) {
    tx = tx.mintAssets(
      {
        [backingInfo.proofOfBackingMph +
        PROOF_OF_BACKING_TOKEN_NAMES.WILTED_FLOWER]: wiltedFlowerMintAmount,
      },
      proofOfBackingMintingRedeemer
    );
  }

  if (totalTeikiRewards > 0) {
    assert(teikiMintingInfo, "Missing teiki minting information");

    assert(
      teikiMintingInfo.teikiMpRefUtxo.scriptRef,
      "Invalid teiki reference script UTxO: Missing inline datum"
    );

    tx = mintTeiki(tx, {
      teikiMintingInfo,
      totalTeikiRewards,
      protocolParams,
      projectDatum,
      txTimeStart,
    });
  }

  return tx;
}
