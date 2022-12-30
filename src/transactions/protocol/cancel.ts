import { Lucid, toHex, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  ProtocolParamsDatum,
  ProtocolProposalDatum,
  ProtocolProposalRedeemer,
} from "@/schema/teiki/protocol";
import { assert } from "@/utils";

export type CancelProtocolTxParams = {
  protocolParamsUtxo: UTxO;
  protocolProposalUtxo: UTxO;
  protocolProposalScriptUtxo: UTxO;
};

export function cancelProtocolProposalTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    protocolProposalUtxo,
    protocolProposalScriptUtxo,
  }: CancelProtocolTxParams
) {
  assert(protocolParamsUtxo.datum, "Protocol params utxo must have datum");
  const protocolParamsDatum: ProtocolParamsDatum = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  assert(
    protocolParamsDatum.governorAddress.paymentCredential.paymentType ===
      "PubKey",
    "Governor address must have a public-key hash credential"
  );
  const protocolGovernorPkh = toHex(
    protocolParamsDatum.governorAddress.paymentCredential.$.pubKeyHash.$hash
  );

  return lucid
    .newTx()
    .addSignerKey(protocolGovernorPkh)
    .readFrom([protocolParamsUtxo, protocolProposalScriptUtxo])
    .collectFrom(
      [protocolProposalUtxo],
      S.toCbor(S.toData({ case: "Cancel" }, ProtocolProposalRedeemer))
    )
    .payToContract(
      protocolProposalUtxo.address,
      { inline: S.toCbor(S.toData({ proposal: null }, ProtocolProposalDatum)) },
      protocolProposalUtxo.assets
    );
}
