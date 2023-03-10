import { Assets, Lucid, UTxO } from "lucid-cardano";

import { constructPlantHashUsingBlake2b } from "@/helpers/schema";
import * as S from "@/schema";
import { Plant, ProofOfBackingMintingRedeemer } from "@/schema/teiki/backing";
import { ProjectDatum } from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { Hex, TimeDifference } from "@/types";
import { assert } from "@/utils";

import { attachTeikiNftMetadata } from "../meta-data";

import { mintTeiki, MintTeikiParams } from "./utils";

export type Params = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO; // project status is not `PreDelisted`
  backingInfo: BackingInfo;
  teikiMintingInfo: TeikiMintingInfo;
  txTime: TimeDifference;
  txTtl?: TimeDifference;
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
    txTime,
    txTtl = 600_000,
  }: Params
) {
  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );

  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
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

  const txTimeStart = txTime;
  const txTimeEnd = txTime + txTtl;

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

    const fruitPlantHash = constructPlantHashUsingBlake2b(fruit);

    mintingPlantAssets = {
      ...mintingPlantAssets,
      [proofOfBackingMph + constructPlantHashUsingBlake2b(flower)]: -1n,
      [proofOfBackingMph + fruitPlantHash]: 1n,
    };

    const backingDuration = BigInt(
      flower.unbackedAt.timestamp - flower.backedAt.timestamp
    );

    const teikiRewards =
      (flower.backingAmount *
        (backingDuration / BigInt(protocolParams.epochLength.milliseconds))) /
      protocolParams.teikiCoefficient;

    totalTeikiRewards += teikiRewards;

    tx = attachTeikiNftMetadata(tx, {
      policyId: backingInfo.proofOfBackingMph,
      assetName: fruitPlantHash,
      nftName: "Teiki Kuda",
      projectId: flower.projectId.id,
      backingAmount: flower.backingAmount,
      duration: backingDuration,
    });
  }

  tx = tx.mintAssets(mintingPlantAssets, proofOfBackingMintingRedeemer);

  const mintTeikiParams: MintTeikiParams = {
    teikiMintingInfo,
    totalTeikiRewards,
    protocolParams,
    projectDatum,
    txTimeStart,
  };
  tx = mintTeiki(tx, mintTeikiParams);

  return tx;
}
