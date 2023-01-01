import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  TeikiPlantDatum,
  TeikiPlantRedeemer,
} from "@/schema/teiki/meta-protocol";
import { TimeDifference } from "@/types";

import { getCurrentTime } from "../helpers/time";

export type ApplyMetaProtocolTxParams = {
  teikiPlantDatum: TeikiPlantDatum;
  teikiPlantUtxo: UTxO;
  teikiPlantScriptUtxo: UTxO;
  txTimePadding?: TimeDifference;
};

export function applyMetaProtocolProposalTx(
  lucid: Lucid,
  {
    teikiPlantDatum,
    teikiPlantUtxo,
    teikiPlantScriptUtxo,
    txTimePadding = 20000,
  }: ApplyMetaProtocolTxParams
) {
  if (!teikiPlantDatum.proposal) {
    throw new Error("Proposed rule cannot be null");
  }
  const txTimeStart = getCurrentTime(lucid) - txTimePadding;
  const teikiPlantRedeemer: TeikiPlantRedeemer = { case: "Apply" };

  const appliedTeikiPlantDatum: TeikiPlantDatum = {
    rules: teikiPlantDatum.proposal.rules,
    proposal: null,
  };

  return lucid
    .newTx()
    .readFrom([teikiPlantScriptUtxo])
    .collectFrom(
      [teikiPlantUtxo],
      S.toCbor(S.toData(teikiPlantRedeemer, TeikiPlantRedeemer))
    )
    .payToContract(
      teikiPlantUtxo.address,
      { inline: S.toCbor(S.toData(appliedTeikiPlantDatum, TeikiPlantDatum)) },
      teikiPlantUtxo.assets
    )
    .validFrom(txTimeStart);
}
