import { Data, Lucid, UTxO } from "lucid-cardano";

import { ProtocolParamsDatum } from "@/schema/teiki/protocol";

export type ReclaimProtocolScriptParams = {
  protocolParamsDatum: ProtocolParamsDatum;
  reclaimUtxos: UTxO[];
};

// TODO: @sk-umiuma: Add the commented params
export function reclaimProtocolScriptTx(
  lucid: Lucid,
  {
    // protocolParamsDatum,
    reclaimUtxos,
  }: ReclaimProtocolScriptParams
) {
  const protocolGovernorPkh = ""; // FIXME:

  return lucid
    .newTx()
    .addSignerKey(protocolGovernorPkh)
    .collectFrom(reclaimUtxos, Data.void());
}
