import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  RulesProposal,
  TeikiPlantDatum,
  TeikiPlantRedeemer,
} from "@/schema/teiki/meta-protocol";
import { TimeDifference } from "@/types";

import { DEFAULT_TIME_PROVIDER, TimeProvider } from "../helpers/time";

export type ProposeMetaProtocolTxParams = {
  teikiPlantDatum: TeikiPlantDatum;
  teikiPlantUtxo: UTxO;
  teikiPlantScriptUtxo: UTxO;
  proposedRules: RulesProposal;
  timeProvider?: TimeProvider;
  txTimePadding?: TimeDifference;
};

export function proposeMetaProtocolProposalTx(
  lucid: Lucid,
  {
    teikiPlantDatum,
    teikiPlantUtxo,
    teikiPlantScriptUtxo,
    proposedRules,
    timeProvider = DEFAULT_TIME_PROVIDER,
    txTimePadding = 20000,
  }: ProposeMetaProtocolTxParams
) {
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
    .validTo(timeProvider() + txTimePadding);
}
