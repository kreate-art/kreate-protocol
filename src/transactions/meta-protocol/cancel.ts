import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  TeikiPlantDatum,
  TeikiPlantRedeemer,
} from "@/schema/teiki/meta-protocol";
import { assert } from "@/utils";

export type CancelMetaProtocolTxParams = {
  teikiPlantUtxo: UTxO;
  teikiPlantScriptUtxo: UTxO;
};

export function cancelMetaProtocolProposalTx(
  lucid: Lucid,
  { teikiPlantUtxo, teikiPlantScriptUtxo }: CancelMetaProtocolTxParams
) {
  assert(
    teikiPlantUtxo.datum,
    "Invalid Teiki plant UTxO: Missing inline datum"
  );

  const teikiPlantDatum = S.fromData(
    S.fromCbor(teikiPlantUtxo.datum),
    TeikiPlantDatum
  );

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
