import { Data, Lucid, UTxO } from "lucid-cardano";

import { extractPaymentPubKeyHash } from "@/helpers/schema";
import * as S from "@/schema";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { assert } from "@/utils";

export type Params = {
  protocolParamsUtxo: UTxO;
  reclaimUtxos: UTxO[];
  protocolScriptVRefScriptUtxo: UTxO;
};

export function reclaimProtocolScriptTx(
  lucid: Lucid,
  { protocolParamsUtxo, reclaimUtxos, protocolScriptVRefScriptUtxo }: Params
) {
  assert(protocolParamsUtxo.datum, "Protocol params utxo must have datum");
  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  const protocolGovernorPkh = extractPaymentPubKeyHash(
    protocolParams.governorAddress
  );

  return lucid
    .newTx()
    .readFrom([protocolParamsUtxo, protocolScriptVRefScriptUtxo])
    .addSignerKey(protocolGovernorPkh)
    .collectFrom(reclaimUtxos, Data.void());
}
