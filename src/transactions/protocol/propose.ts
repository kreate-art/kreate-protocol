import { Data, Lucid, Redeemer, UTxO } from "lucid-cardano";

import { ProtocolParamsDatum } from "@/schema/teiki/protocol";

export type ProposeTxParams = {
  protocolParamsDatum: ProtocolParamsDatum;
  protocolParamsUtxo: UTxO;
  proposedProtocolParamsDatum: ProtocolParamsDatum;
  protocolProposalUtxo: UTxO;
  protocolScriptUtxo: UTxO;
};

// TODO: @sk-umiuma: Add the commented params
export function proposeProposalTx(
  lucid: Lucid,
  {
    // protocolParamsDatum,
    protocolParamsUtxo,
    // proposedProtocolParamsDatum,
    protocolProposalUtxo,
    protocolScriptUtxo,
  }: ProposeTxParams
) {
  const protocolGovernorPkh = ""; // FIXME:
  // TODO: @sk-umiuma: Implement this
  const redeemer: Redeemer = Data.empty();

  return lucid
    .newTx()
    .addSignerKey(protocolGovernorPkh)
    .readFrom([protocolParamsUtxo, protocolScriptUtxo])
    .collectFrom([protocolProposalUtxo], redeemer)
    .payToContract(
      protocolProposalUtxo.address,
      { inline: Data.empty() }, // FIXME:
      protocolProposalUtxo.assets
    );
}
