import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  TeikiPlantDatum,
  TeikiPlantRedeemer,
} from "@/schema/teiki/meta-protocol";

export type CancelMetaProtocolTxParams = {
  teikiPlantDatum: TeikiPlantDatum;
  teikiPlantUtxo: UTxO;
  teikiPlantScriptUtxo: UTxO;
};

export function cancelMetaProtocolProposalTx(
  lucid: Lucid,
  {
    teikiPlantDatum,
    teikiPlantUtxo,
    teikiPlantScriptUtxo,
  }: CancelMetaProtocolTxParams
) {
  const teikiPlantRedeemer: TeikiPlantRedeemer = { case: "Cancel" };

  const canceledTeikiPlantDatum: TeikiPlantDatum = {
    rules: teikiPlantDatum.rules,
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
      { inline: S.toCbor(S.toData(canceledTeikiPlantDatum, TeikiPlantDatum)) },
      teikiPlantUtxo.assets
    );
}
