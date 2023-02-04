import assert from "assert";

import { UTxO, Tx, Unit } from "lucid-cardano";

import { TEIKI_TOKEN_NAME } from "@/contracts/common/constants";
import * as S from "@/schema";
import { Plant } from "@/schema/teiki/backing";
import { TeikiMintingRedeemer } from "@/schema/teiki/meta-protocol";
import { ProjectDatum } from "@/schema/teiki/project";
import {
  ProtocolParamsDatum,
  LegacyProtocolParamsDatum,
} from "@/schema/teiki/protocol";
import {
  BurnAction,
  ProjectTeiki,
  SharedTreasuryDatum,
  SharedTreasuryRedeemer,
} from "@/schema/teiki/treasury";
import { Hex } from "@/types";

import { RATIO_MULTIPLIER } from "../constants";
import { Fraction, exponentialFraction } from "../fraction";

// This is a mirror of `calculate_teiki_remaining` in src/contracts/common/helpers.ts
export function calculateTeikiRemaining(
  available: bigint,
  burnRateInv: bigint,
  epochs: number
): bigint {
  const r: Fraction = exponentialFraction(
    { numerator: burnRateInv, denominator: RATIO_MULTIPLIER },
    epochs
  );

  return ((r.denominator - r.numerator) * available) / r.denominator;
}

export type TeikiMintingInfo = {
  teikiMph: Hex;
  teikiMpRefUtxo: UTxO;
  teikiPlantVRefUtxo: UTxO;
  sharedTreasuryVRefUtxo: UTxO;
  sharedTreasuryUtxo: UTxO;
};

export type MintTeikiParams = {
  teikiMintingInfo: TeikiMintingInfo;
  totalTeikiRewards: bigint;
  protocolParams: ProtocolParamsDatum | LegacyProtocolParamsDatum;
  projectDatum: ProjectDatum;
  txTimeStart: number;
};

export function mintTeiki(
  tx: Tx,
  {
    teikiMintingInfo,
    totalTeikiRewards,
    protocolParams,
    projectDatum,
    txTimeStart,
  }: MintTeikiParams
) {
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

  return tx
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
    .mintAssets(
      { [teikiUnit]: teikiMint },
      S.toCbor(S.toData({ case: "Mint" }, TeikiMintingRedeemer))
    );
}

//https://www.hyperion-bt.org/helios-book/lang/builtins/txoutputid.html
export function sortPlantByBackingOutputId(plants: Plant[]) {
  return plants.sort((p1, p2) => {
    if (p1.backingOutputId.txId == p2.backingOutputId.txId)
      return p1.backingOutputId.index > p2.backingOutputId.index ? 1 : -1;

    return p1.backingOutputId.txId > p2.backingOutputId.txId ? 1 : -1;
  });
}
