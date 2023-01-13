import { Address, Lucid, Tx, UTxO, Unit } from "lucid-cardano";

import {
  PROOF_OF_BACKING_TOKEN_NAMES,
  TEIKI_TOKEN_NAME,
} from "@/contracts/common/constants";
import { getCurrentTime } from "@/helpers/lucid";
import {
  constructAddress,
  constructTxOutputId,
  constructPlantHashUsingBlake2b,
} from "@/helpers/schema";
import * as S from "@/schema";
import {
  BackingDatum,
  BackingRedeemer,
  Plant,
  ProofOfBackingMintingRedeemer,
} from "@/schema/teiki/backing";
import { TeikiMintingRedeemer } from "@/schema/teiki/meta-protocol";
import { ProjectDatum } from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import {
  SharedTreasuryDatum,
  SharedTreasuryRedeemer,
} from "@/schema/teiki/treasury";
import { Hex, TimeDifference } from "@/types";
import { assert } from "@/utils";

import { RATIO_MULTIPLIER } from "../constants";

import { calculateTeikiRemaining } from "./utils";

export type ProjectInfo = {
  id: Hex;
  currentMilestone: bigint;
  projectUtxo: UTxO;
  projectScriptUtxo: UTxO;
};

export type BackingInfo = {
  // negative for unstaking
  // positive for backing
  amount: bigint;
  backerAddress: Address;
  backingUtxos: UTxO[];
  backingScriptAddress: Address;
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

  const now = getCurrentTime(lucid);
  const txTimeStart = now - txTimeStartPadding;
  const txTimeEnd = now + txTimeEndPadding;

  const totalBackingAmount = backingInfo.backingUtxos.reduce(
    (acc, backingUtxo) => acc + BigInt(backingUtxo.assets.lovelace),
    0n
  );

  const remainBackingAmount = totalBackingAmount + backingInfo.amount;

  assert(
    remainBackingAmount >= 0n,
    "Current backing amount does not cover the unstake amount"
  );

  let tx = lucid
    .newTx()
    .addSigner(backingInfo.backerAddress)
    .readFrom([
      proofOfBackingMpRefUtxo,
      projectInfo.projectUtxo,
      protocolParamsUtxo,
      projectInfo.projectScriptUtxo,
    ])
    .validFrom(txTimeStart)
    .validTo(txTimeEnd);

  // NOTE: We may only need to produce multiple backing UTxOs in case of cleanup
  const numProducedBackingUtxos = remainBackingAmount === 0n ? 0 : 1;

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

  // Check whether the backer unstake or not
  if (backingInfo.amount < 0n) {
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
    const backingDatum: BackingDatum = {
      projectId: { id: projectInfo.id },
      backerAddress: constructAddress(backingInfo.backerAddress),
      stakedAt: { timestamp: BigInt(txTimeEnd) },
      milestoneBacked: projectInfo.currentMilestone,
    };

    tx = tx.payToContract(
      backingInfo.backingScriptAddress,
      {
        inline: S.toCbor(S.toData(backingDatum, BackingDatum)),
      },
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
      S.toCbor(S.toData({ case: "Unstake" }, BackingRedeemer))
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

  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  const projectDatum = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  const unstakedAt = txTimeStart;
  let totalTeikiRewards = 0n;

  for (const backingUtxo of backingInfo.backingUtxos) {
    assert(
      backingUtxo.datum != null,
      "Invalid backing UTxO: Missing inline datum"
    );

    const backingDatum = S.fromData(
      S.fromCbor(backingUtxo.datum),
      BackingDatum
    );

    const timePassed = BigInt(unstakedAt) - backingDatum.stakedAt.timestamp;

    if (timePassed < 0n) throw new Error("Invalid unstake time");
    if (timePassed >= protocolParams.epochLength.milliseconds) {
      const backingAmount = BigInt(backingUtxo.assets.lovelace);

      const isMatured =
        backingDatum.milestoneBacked < projectDatum.milestoneReached &&
        projectDatum.status.type !== "PreDelisted";

      const plant: Plant = {
        isMatured,
        backingOutputId: constructTxOutputId(backingUtxo),
        backingAmount,
        unstakedAt: { timestamp: BigInt(unstakedAt) },
        ...backingDatum,
      };

      const plantHash = constructPlantHashUsingBlake2b(plant);

      tx = tx.mintAssets(
        { [backingInfo.proofOfBackingMph + plantHash]: 1n },
        proofOfBackingMintingRedeemer
      );

      const teikiRewards = isMatured
        ? (backingAmount *
            BigInt(BigInt(unstakedAt) - backingDatum.stakedAt.timestamp)) /
          BigInt(protocolParams.epochLength.milliseconds) /
          protocolParams.teikiCoefficient
        : 0n;

      totalTeikiRewards += teikiRewards;
    } else {
      tx = tx.mintAssets(
        {
          [backingInfo.proofOfBackingMph +
          PROOF_OF_BACKING_TOKEN_NAMES.WILTED_FLOWER]: 1n,
        },
        proofOfBackingMintingRedeemer
      );
    }
  }

  if (totalTeikiRewards > 0) {
    assert(teikiMintingInfo, "Missing teiki minting information");

    assert(
      teikiMintingInfo.teikiMpRefUtxo.scriptRef,
      "Invalid teiki reference script UTxO: Missing inline datum"
    );

    tx = mintTeiki(
      tx,
      teikiMintingInfo,
      totalTeikiRewards,
      protocolParams,
      txTimeStart
    );
  }

  return tx;
}

function mintTeiki(
  tx: Tx,
  teikiMintingInfo: TeikiMintingInfo,
  totalTeikiRewards: bigint,
  protocolParams: ProtocolParamsDatum,
  txTimeStart: number
) {
  const teikiUnit: Unit = teikiMintingInfo.teikiMph + TEIKI_TOKEN_NAME;

  const inputSharedTreasuryUtxo = teikiMintingInfo.sharedTreasuryUtxo;

  assert(
    inputSharedTreasuryUtxo.datum != null,
    "Missing shared treasury UTxO: Missing inline datum"
  );

  const inputSharedTreasuryDatum = S.fromData(
    S.fromCbor(inputSharedTreasuryUtxo.datum),
    SharedTreasuryDatum
  );

  const inputSharedTreasuryTeikiAmount =
    inputSharedTreasuryUtxo.assets[teikiUnit] ?? 0n;

  let sharedTreasuryRedeemer: SharedTreasuryRedeemer;
  let remainingTeikiAmount: bigint;
  let projectRewards: bigint;
  let outputLastBurnAtTimestamp: bigint;
  switch (inputSharedTreasuryDatum.projectTeiki.teikiCondition) {
    case "TeikiEmpty":
      sharedTreasuryRedeemer = {
        case: "UpdateTeiki",
        burnAction: { burn: "BurnPeriodically" },
        burnAmount: 0n,
        rewards: totalTeikiRewards,
      };
      remainingTeikiAmount = 0n;
      projectRewards = sharedTreasuryRedeemer.rewards;
      outputLastBurnAtTimestamp = BigInt(txTimeStart);
      break;
    case "TeikiBurntPeriodically": {
      const epochs = Math.floor(
        (txTimeStart -
          Number(inputSharedTreasuryDatum.projectTeiki.lastBurnAt.timestamp)) /
          Number(protocolParams.epochLength.milliseconds)
      );

      remainingTeikiAmount = calculateTeikiRemaining(
        inputSharedTreasuryDatum.projectTeiki.available,
        RATIO_MULTIPLIER - protocolParams.projectTeikiBurnRate,
        epochs
      );

      const burnAmount =
        inputSharedTreasuryDatum.projectTeiki.available - remainingTeikiAmount;

      sharedTreasuryRedeemer = {
        case: "UpdateTeiki",
        burnAction: { burn: "BurnPeriodically" },
        burnAmount: burnAmount,
        rewards: totalTeikiRewards,
      };

      projectRewards = sharedTreasuryRedeemer.rewards;

      outputLastBurnAtTimestamp =
        inputSharedTreasuryDatum.projectTeiki.lastBurnAt.timestamp +
        BigInt(epochs * Number(protocolParams.epochLength.milliseconds));
      break;
    }
    case "TeikiBurntEntirely":
      // TODO: @sk-saru
      throw new Error("Not support case TeikiBurntEntirely");
  }

  const teikiMint = 3n * totalTeikiRewards - sharedTreasuryRedeemer.burnAmount;

  const outputSharedTreasuryTeikiAmount: bigint =
    inputSharedTreasuryTeikiAmount +
    sharedTreasuryRedeemer.rewards +
    projectRewards -
    sharedTreasuryRedeemer.burnAmount;

  const outputSharedTreasuryDatum: SharedTreasuryDatum = {
    ...inputSharedTreasuryDatum,
    governorTeiki:
      inputSharedTreasuryDatum.governorTeiki +
      (sharedTreasuryRedeemer.rewards * protocolParams.governorShareRatio) /
        RATIO_MULTIPLIER,
    projectTeiki: {
      teikiCondition: "TeikiBurntPeriodically",
      available: remainingTeikiAmount + sharedTreasuryRedeemer.rewards,
      lastBurnAt: { timestamp: outputLastBurnAtTimestamp },
    },
    tag: {
      kind: "TagContinuation",
      former: {
        txId: inputSharedTreasuryUtxo.txHash,
        index: BigInt(inputSharedTreasuryUtxo.outputIndex),
      },
    },
  };

  return tx
    .readFrom([
      teikiMintingInfo.sharedTreasuryVRefUtxo,
      teikiMintingInfo.teikiMpRefUtxo,
      teikiMintingInfo.teikiPlantVRefUtxo,
    ])
    .collectFrom(
      [inputSharedTreasuryUtxo],
      S.toCbor(S.toData(sharedTreasuryRedeemer, SharedTreasuryRedeemer))
    )
    .payToContract(
      inputSharedTreasuryUtxo.address,
      {
        inline: S.toCbor(
          S.toData(outputSharedTreasuryDatum, SharedTreasuryDatum)
        ),
      },
      {
        ...inputSharedTreasuryUtxo.assets,
        [teikiUnit]: outputSharedTreasuryTeikiAmount,
      }
    )
    .mintAssets(
      { [teikiUnit]: teikiMint },
      S.toCbor(S.toData({ case: "Mint" }, TeikiMintingRedeemer))
    );
}
