import { Address, Lucid, Tx, UTxO, Unit } from "lucid-cardano";

import {
  INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS,
  PROOF_OF_BACKING_TOKEN_NAMES,
  TEIKI_TOKEN_NAME,
} from "@/contracts/common/constants";
import { getCurrentTime } from "@/helpers/lucid";
import {
  constructTxOutputId,
  constructPlantHashUsingBlake2b,
  deconstructAddress,
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
import { UserTag } from "@/schema/teiki/tags";
import {
  SharedTreasuryDatum,
  SharedTreasuryRedeemer,
} from "@/schema/teiki/treasury";
import { Hex, TimeDifference } from "@/types";
import { assert } from "@/utils";

import { RATIO_MULTIPLIER } from "../constants";

import { calculateTeikiRemaining } from "./utils";

// NOTE: @sk-saru clean up by project id for now
export type ProjectInfo = {
  id: Hex;
  currentMilestone: bigint;
  projectUtxo: UTxO;
  projectScriptUtxo: UTxO;
};

export type CleanUpInfo = {
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

export type CleanUpParams = {
  protocolParamsUtxo: UTxO;
  projectInfo: ProjectInfo;
  cleanUpInfo: CleanUpInfo;
  teikiMintingInfo: TeikiMintingInfo;
  txTimeStartPadding?: TimeDifference;
  txTimeEndPadding?: TimeDifference;
};

export function cleanUpTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectInfo,
    cleanUpInfo,
    teikiMintingInfo,
    txTimeStartPadding = 20_000,
    txTimeEndPadding = 60_000,
  }: CleanUpParams
) {
  const proofOfBackingMpRefUtxo = cleanUpInfo.proofOfBackingMpRefUtxo;

  assert(
    proofOfBackingMpRefUtxo.scriptRef != null,
    "Invalid proof of backing reference UTxO: must reference proof of backing script"
  );

  // NOTE: cleanUp = true
  const proofOfBackingMintingRedeemer = S.toCbor(
    S.toData({ case: "Plant", cleanup: true }, ProofOfBackingMintingRedeemer)
  );

  const now = getCurrentTime(lucid);
  const txTimeStart = now - txTimeStartPadding;
  const txTimeEnd = now + txTimeEndPadding;

  const seedUnit =
    cleanUpInfo.proofOfBackingMph + PROOF_OF_BACKING_TOKEN_NAMES.SEED;

  let tx = lucid
    .newTx()
    .readFrom([
      proofOfBackingMpRefUtxo,
      projectInfo.projectUtxo,
      protocolParamsUtxo,
      projectInfo.projectScriptUtxo,
      cleanUpInfo.backingScriptRefUtxo,
    ])
    .collectFrom(
      cleanUpInfo.backingUtxos,
      S.toCbor(S.toData({ case: "Unstake" }, BackingRedeemer))
    )
    .mintAssets(
      { [seedUnit]: BigInt(-cleanUpInfo.backingUtxos.length) },
      proofOfBackingMintingRedeemer
    )
    .validFrom(txTimeStart)
    .validTo(txTimeEnd);

  tx = addMintingInstruction(lucid, tx, {
    cleanUpInfo,
    protocolParamsUtxo,
    projectUtxo: projectInfo.projectUtxo,
    teikiMintingInfo,
    txTimeStart,
    proofOfBackingMintingRedeemer,
  });

  return tx;
}

type MintingInstructionParams = {
  cleanUpInfo: CleanUpInfo;
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  teikiMintingInfo: TeikiMintingInfo;
  txTimeStart: number;
  proofOfBackingMintingRedeemer: Hex;
};

function addMintingInstruction(
  lucid: Lucid,
  tx: Tx,
  {
    cleanUpInfo,
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

  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  const projectDatum = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  const unstakedAt = txTimeStart;
  let totalTeikiRewards = 0n;
  let wiltedFlowerMintAmount = 0n;
  const wiltedFlowerUnit: Unit =
    cleanUpInfo.proofOfBackingMph + PROOF_OF_BACKING_TOKEN_NAMES.WILTED_FLOWER;
  const discount =
    protocolParams.discountCentPrice * INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS;

  const teikiUnit: Unit = teikiMintingInfo.teikiMph + TEIKI_TOKEN_NAME;

  for (const backingUtxo of cleanUpInfo.backingUtxos) {
    assert(
      backingUtxo.datum != null,
      "Invalid backing UTxO: Missing inline datum"
    );

    const backingDatum = S.fromData(
      S.fromCbor(backingUtxo.datum),
      BackingDatum
    );

    const userTag: UserTag = {
      kind: "TagInactiveBacking",
      backingOutputId: constructTxOutputId(backingUtxo),
    };

    const backerAddress: Address = deconstructAddress(
      lucid,
      backingDatum.backerAddress
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

      const teikiRewards = isMatured
        ? (backingAmount *
            BigInt(BigInt(unstakedAt) - backingDatum.stakedAt.timestamp)) /
          BigInt(protocolParams.epochLength.milliseconds) /
          protocolParams.teikiCoefficient
        : 0n;

      tx = tx
        .mintAssets(
          { [cleanUpInfo.proofOfBackingMph + plantHash]: 1n },
          proofOfBackingMintingRedeemer
        )
        .payToAddressWithData(
          backerAddress,
          {
            inline: S.toCbor(S.toData(userTag, UserTag)),
          },
          {
            lovelace: BigInt(backingUtxo.assets.lovelace) - discount,
            [teikiUnit]: teikiRewards,
          }
        );

      totalTeikiRewards += teikiRewards;
    } else {
      wiltedFlowerMintAmount += 1n;

      tx = tx.payToAddressWithData(
        backerAddress,
        {
          inline: S.toCbor(S.toData(userTag, UserTag)),
        },
        {
          lovelace: BigInt(backingUtxo.assets.lovelace) - discount,
          [wiltedFlowerUnit]: 1n,
        }
      );
    }
  }

  if (wiltedFlowerMintAmount > 0n) {
    tx = tx.mintAssets(
      {
        [wiltedFlowerUnit]: wiltedFlowerMintAmount,
      },
      proofOfBackingMintingRedeemer
    );
  }

  if (totalTeikiRewards > 0) {
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
