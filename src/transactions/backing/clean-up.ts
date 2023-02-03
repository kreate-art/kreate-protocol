import { Address, Lucid, Tx, UTxO, Unit } from "lucid-cardano";

import {
  INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS,
  PROOF_OF_BACKING_TOKEN_NAMES,
  TEIKI_TOKEN_NAME,
} from "@/contracts/common/constants";
import {
  constructTxOutputId,
  constructPlantHashUsingBlake2b,
  deconstructAddress,
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
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { UserTag } from "@/schema/teiki/tags";
import { Hex, TimeDifference } from "@/types";
import { assert } from "@/utils";

import { mintTeiki } from "./utils";

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
  timeProvider?: TimeProvider;
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
    timeProvider,
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

  const now = getTime({ timeProvider, lucid });
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
