import { Assets, Lucid, UTxO, Unit } from "lucid-cardano";

import { TEIKI_TOKEN_NAME } from "@/contracts/common/constants";
import {
  constructPlantHashUsingBlake2b,
  parseProtocolParams,
} from "@/helpers/schema";
import { TimeProvider, getTime } from "@/helpers/time";
import * as S from "@/schema";
import { Plant, ProofOfBackingMintingRedeemer } from "@/schema/teiki/backing";
import { TeikiMintingRedeemer } from "@/schema/teiki/meta-protocol";
import { ProjectDatum } from "@/schema/teiki/project";
import {
  BurnAction,
  ProjectTeiki,
  SharedTreasuryDatum,
  SharedTreasuryRedeemer,
} from "@/schema/teiki/treasury";
import { Hex, TimeDifference } from "@/types";
import { assert } from "@/utils";

import { RATIO_MULTIPLIER } from "../constants";

import { calculateTeikiRemaining } from "./utils";

export type Params = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO; // project status is not `PreDelisted`
  backingInfo: BackingInfo;
  teikiMintingInfo: TeikiMintingInfo;
  txTimeStartPadding?: TimeDifference;
  txTimeEndPadding?: TimeDifference;
  timeProvider?: TimeProvider;
};

export type BackingInfo = {
  // sorted by backing TxOutputId
  // and milestone backed does not reach the current project milestone
  flowers: Plant[];
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

export function claimRewardsByFlowerTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    backingInfo,
    teikiMintingInfo,
    txTimeStartPadding = 60_000,
    txTimeEndPadding = 60_000,
    timeProvider,
  }: Params
) {
  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );

  const { protocolParams } = parseProtocolParams(
    S.fromCbor(protocolParamsUtxo.datum)
  );

  const { proofOfBackingMpRefUtxo, flowers } = backingInfo;

  assert(
    proofOfBackingMpRefUtxo.scriptRef != null,
    "Invalid proof of backing reference UTxO: must reference proof of backing script"
  );

  const proofOfBackingMph = lucid.utils.validatorToScriptHash(
    proofOfBackingMpRefUtxo.scriptRef
  );

  const proofOfBackingMintingRedeemer = S.toCbor(
    S.toData({ case: "ClaimRewards", flowers }, ProofOfBackingMintingRedeemer)
  );

  assert(
    projectUtxo.datum != null,
    "Invalid project UTxO: Missing inline datum"
  );

  const projectDatum = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  assert(
    projectDatum.status.type != "PreDelisted",
    "Unable to claim rewards when project status is pre-delisted"
  );

  const projectId = projectDatum.projectId.id;
  const currentProjectMilestone = projectDatum.milestoneReached;

  const now = getTime({ timeProvider, lucid });
  const txTimeStart = now - txTimeStartPadding;
  const txTimeEnd = now + txTimeEndPadding;

  let tx = lucid
    .newTx()
    .readFrom([proofOfBackingMpRefUtxo, projectUtxo, protocolParamsUtxo])
    .validFrom(txTimeStart)
    .validTo(txTimeEnd);

  let mintingPlantAssets: Assets = {};
  let totalTeikiRewards = 0n;
  for (const flower of flowers) {
    assert(flower.isMatured === false, "Unable to claim rewards by fruit");

    assert(flower.projectId.id === projectId, "Incorrect flower project id");

    assert(
      flower.milestoneBacked < currentProjectMilestone,
      "Invalid flower milestone backed"
    );

    const fruit: Plant = {
      ...flower,
      isMatured: true,
    };

    mintingPlantAssets = {
      ...mintingPlantAssets,
      [proofOfBackingMph + constructPlantHashUsingBlake2b(flower)]: -1n,
      [proofOfBackingMph + constructPlantHashUsingBlake2b(fruit)]: 1n,
    };

    const teikiRewards =
      (flower.backingAmount *
        BigInt(flower.unstakedAt.timestamp - flower.stakedAt.timestamp)) /
      BigInt(protocolParams.epochLength.milliseconds) /
      protocolParams.teikiCoefficient;

    totalTeikiRewards += teikiRewards;
  }

  const { sharedTreasuryUtxo, teikiMph } = teikiMintingInfo;
  const teikiUnit: Unit = teikiMph + TEIKI_TOKEN_NAME;

  assert(
    sharedTreasuryUtxo.datum != null,
    "Missing shared treasury UTxO: Missing inline datum"
  );

  const inputSharedTreasuryDatum = S.fromData(
    S.fromCbor(sharedTreasuryUtxo.datum),
    SharedTreasuryDatum
  );

  const inputSharedTreasuryTeikiAmount = BigInt(
    sharedTreasuryUtxo.assets[teikiUnit] ?? 0n
  );

  let burnAction: BurnAction;

  let teikiMint: bigint;
  let burnAmount: bigint;
  let newProjectTeiki: ProjectTeiki;

  if (projectDatum.status.type === "Delisted") {
    burnAction = { burn: "BurnEntirely" };

    switch (inputSharedTreasuryDatum.projectTeiki.teikiCondition) {
      case "TeikiEmpty":
        burnAmount = 0n;
        break;
      case "TeikiBurntPeriodically":
        burnAmount = inputSharedTreasuryDatum.projectTeiki.available;
        break;
      case "TeikiBurntEntirely":
        burnAmount = 0n;
    }

    newProjectTeiki = {
      teikiCondition: "TeikiBurntEntirely",
    };
    teikiMint = 2n * totalTeikiRewards - burnAmount;
  } else {
    burnAction = { burn: "BurnPeriodically" };

    switch (inputSharedTreasuryDatum.projectTeiki.teikiCondition) {
      case "TeikiEmpty": {
        burnAmount = 0n;
        newProjectTeiki = {
          teikiCondition: "TeikiBurntPeriodically",
          available: totalTeikiRewards,
          lastBurnAt: { timestamp: BigInt(txTimeStart) },
        };
        break;
      }
      case "TeikiBurntPeriodically": {
        const epochs = Math.floor(
          (txTimeStart -
            Number(
              inputSharedTreasuryDatum.projectTeiki.lastBurnAt.timestamp
            )) /
            Number(protocolParams.epochLength.milliseconds)
        );

        if (epochs === 0) {
          burnAmount = 0n;
          newProjectTeiki = {
            teikiCondition: "TeikiBurntPeriodically",
            available:
              inputSharedTreasuryDatum.projectTeiki.available +
              totalTeikiRewards,
            lastBurnAt: inputSharedTreasuryDatum.projectTeiki.lastBurnAt,
          };
          break;
        }

        const remainingTeikiAmount = calculateTeikiRemaining(
          inputSharedTreasuryDatum.projectTeiki.available,
          RATIO_MULTIPLIER - protocolParams.projectTeikiBurnRate,
          epochs
        );

        burnAmount =
          inputSharedTreasuryDatum.projectTeiki.available -
          remainingTeikiAmount;

        newProjectTeiki = {
          teikiCondition: "TeikiBurntPeriodically",
          available: remainingTeikiAmount + totalTeikiRewards,
          lastBurnAt: {
            timestamp:
              inputSharedTreasuryDatum.projectTeiki.lastBurnAt.timestamp +
              BigInt(epochs * Number(protocolParams.epochLength.milliseconds)),
          },
        };

        break;
      }
      case "TeikiBurntEntirely": {
        throw new Error(
          "Not support case TeikiBurntEntirely in case of BurnPeriodically"
        );
      }
    }
    teikiMint = 3n * totalTeikiRewards - burnAmount;
  }

  const sharedTreasuryRedeemer: SharedTreasuryRedeemer = {
    case: "UpdateTeiki",
    burnAction,
    burnAmount,
    rewards: totalTeikiRewards,
  };

  const outputSharedTreasuryDatum: SharedTreasuryDatum = {
    ...inputSharedTreasuryDatum,
    governorTeiki:
      inputSharedTreasuryDatum.governorTeiki +
      (sharedTreasuryRedeemer.rewards * protocolParams.governorShareRatio) /
        RATIO_MULTIPLIER,
    projectTeiki: { ...newProjectTeiki },
    tag: {
      kind: "TagContinuation",
      former: {
        txId: sharedTreasuryUtxo.txHash,
        index: BigInt(sharedTreasuryUtxo.outputIndex),
      },
    },
  };

  const outputSharedTreasuryTeikiAmount: bigint =
    inputSharedTreasuryTeikiAmount +
    sharedTreasuryRedeemer.rewards +
    totalTeikiRewards -
    sharedTreasuryRedeemer.burnAmount;

  tx = tx
    .readFrom([
      teikiMintingInfo.sharedTreasuryVRefUtxo,
      teikiMintingInfo.teikiMpRefUtxo,
      teikiMintingInfo.teikiPlantVRefUtxo,
    ])
    .collectFrom(
      [sharedTreasuryUtxo],
      S.toCbor(S.toData(sharedTreasuryRedeemer, SharedTreasuryRedeemer))
    )
    .payToContract(
      sharedTreasuryUtxo.address,
      {
        inline: S.toCbor(
          S.toData(outputSharedTreasuryDatum, SharedTreasuryDatum)
        ),
      },
      {
        ...sharedTreasuryUtxo.assets,
        [teikiUnit]: outputSharedTreasuryTeikiAmount,
      }
    )
    .mintAssets(mintingPlantAssets, proofOfBackingMintingRedeemer)
    .mintAssets(
      { [teikiUnit]: teikiMint },
      S.toCbor(S.toData({ case: "Mint" }, TeikiMintingRedeemer))
    );

  return tx;
}
