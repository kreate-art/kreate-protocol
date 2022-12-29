import { Data, Lucid, Redeemer, UTxO } from "lucid-cardano";

import { ProtocolParamsDatum } from "@/schema/teiki/protocol";

export type ApplyTxParams = {
  protocolParamsDatum: ProtocolParamsDatum;
  protocolParamsUtxo: UTxO;
  proposedProtocolParamsDatum: ProtocolParamsDatum;
  protocolProposalUtxo: UTxO;
  protocolScriptUtxos: [UTxO];
};

export function applyProposalTx(
  lucid: Lucid,
  {
    // protocolParamsDatum,
    // proposedProtocolParamsDatum,
    protocolParamsUtxo,
    protocolProposalUtxo,
    protocolScriptUtxos,
  }: ApplyTxParams
) {
  const protocolGovernorPkh = ""; // FIXME:

  // TODO: @sk-umiuma: Implement this
  const protocolParamsRedeemer: Redeemer = Data.empty();
  // TODO: @sk-umiuma: Implement this
  const protocolProposalRedeemer: Redeemer = Data.empty();

  return lucid
    .newTx()
    .addSigner(protocolGovernorPkh)
    .readFrom(protocolScriptUtxos)
    .collectFrom([protocolParamsUtxo], protocolParamsRedeemer)
    .collectFrom([protocolProposalUtxo], protocolProposalRedeemer)
    .payToContract(
      protocolProposalUtxo.address,
      { inline: Data.empty() },
      protocolProposalUtxo.assets
    )
    .payToContract(
      protocolParamsUtxo.address,
      { inline: Data.empty() }, // FIXME:
      protocolParamsUtxo.assets
    );
}
