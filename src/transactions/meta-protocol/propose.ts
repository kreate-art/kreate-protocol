import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  RulesProposal,
  TeikiPlantDatum,
  TeikiPlantRedeemer,
} from "@/schema/teiki/meta-protocol";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

import { getCurrentTime } from "../helpers/lucid";

export type ProposeMetaProtocolTxParams = {
  teikiPlantUtxo: UTxO;
  teikiPlantScriptUtxo: UTxO;
  proposedRules: RulesProposal;
  txTimePadding?: TimeDifference;
};

export function proposeMetaProtocolProposalTx(
  lucid: Lucid,
  {
    teikiPlantUtxo,
    teikiPlantScriptUtxo,
    proposedRules,
    txTimePadding = 20000,
  }: ProposeMetaProtocolTxParams
) {
  assert(
    teikiPlantUtxo.datum != null,
    "Invalid Teiki plant UTxO: Missing inline datum"
  );

  const teikiPlantDatum = S.fromData(
    S.fromCbor(teikiPlantUtxo.datum),
    TeikiPlantDatum
  );

  const teikiPlantRedeemer: TeikiPlantRedeemer = { case: "Propose" };

  const newTeikiPlantDatum: TeikiPlantDatum = {
    ...teikiPlantDatum,
    proposal: proposedRules,
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
      { inline: S.toCbor(S.toData(newTeikiPlantDatum, TeikiPlantDatum)) },
      teikiPlantUtxo.assets
    )
    .validTo(getCurrentTime(lucid) + txTimePadding);
}
