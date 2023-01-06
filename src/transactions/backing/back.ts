import { Address, Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  BackingDatum,
  ProofOfBackingMintingRedeemer,
} from "@/schema/teiki/backing";
import { Hex, TimeDifference } from "@/types";
import { assert } from "@/utils";

import { getCurrentTime } from "../../helpers/lucid";
import { constructAddress } from "../../helpers/schema";

export type ProjectInfo = {
  id: Hex;
  currentMilestone: bigint;
};

export type BackingInfo = {
  amount: bigint;
  backerAddress: Address;
};

export type CreateBackingParams = {
  protocolParamsUtxo: UTxO;
  projectInfo: ProjectInfo;
  backingInfo: BackingInfo;
  backingScriptAddress: Address;
  proofOfBackingPolicyRefUtxo: UTxO;
  projectUtxo: UTxO;
  projectScriptUtxo: UTxO;
  txTimePadding?: TimeDifference;
};

// This is a case of plant transaction with minimize information
export function createBackingTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectInfo,
    backingInfo,
    backingScriptAddress,
    proofOfBackingPolicyRefUtxo,
    projectUtxo,
    projectScriptUtxo,
    txTimePadding = 200000,
  }: CreateBackingParams
) {
  assert(
    proofOfBackingPolicyRefUtxo.scriptRef != null,
    "Invalid proof of backing reference UTxO: must reference proof of backing script"
  );

  const txTimeEnd = getCurrentTime(lucid) + txTimePadding;

  const backingDatum: BackingDatum = {
    projectId: { id: projectInfo.id },
    backerAddress: constructAddress(backingInfo.backerAddress),
    stakedAt: { timestamp: BigInt(txTimeEnd) },
    milestoneBacked: projectInfo.currentMilestone,
  };

  const proofOfBackingMph = lucid.utils.validatorToScriptHash(
    proofOfBackingPolicyRefUtxo.scriptRef
  );

  return lucid
    .newTx()
    .addSigner(backingInfo.backerAddress)
    .readFrom([
      proofOfBackingPolicyRefUtxo,
      projectUtxo,
      projectScriptUtxo,
      protocolParamsUtxo,
    ])
    .mintAssets(
      { [proofOfBackingMph]: 1n },
      S.toCbor(
        S.toData(
          { case: "Plant", cleanup: false },
          ProofOfBackingMintingRedeemer
        )
      )
    )
    .payToContract(
      backingScriptAddress,
      {
        inline: S.toCbor(S.toData(backingDatum, BackingDatum)),
      },
      { [proofOfBackingMph]: 1n, lovelace: backingInfo.amount }
    )
    .validTo(txTimeEnd);
}
