import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  TeikiPlantDatum,
  TeikiPlantRedeemer,
} from "@/schema/teiki/meta-protocol";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

export type ApplyMetaProtocolTxParams = {
  teikiPlantUtxo: UTxO;
  teikiPlantScriptUtxo: UTxO;
  txTime: TimeDifference;
};

export function applyMetaProtocolProposalTx(
  lucid: Lucid,
  { teikiPlantUtxo, teikiPlantScriptUtxo, txTime }: ApplyMetaProtocolTxParams
) {
  assert(
    teikiPlantUtxo.datum != null,
    "Invalid Teiki plant UTxO: Missing inline datum"
  );
  const teikiPlantDatum = S.fromData(
    S.fromCbor(teikiPlantUtxo.datum),
    TeikiPlantDatum
  );

  assert(
    teikiPlantDatum.proposal,
    "Invalid Teiki plant datum: Proposed rule cannot be null"
  );
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
    .validFrom(txTime);
}
