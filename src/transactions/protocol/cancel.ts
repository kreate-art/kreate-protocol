import { Data, Lucid, PaymentKeyHash, Redeemer, UTxO } from "lucid-cardano";

export type CancelTxParams = {
  protocolParamsUtxo: UTxO;
  protocolProposalUtxo: UTxO;
  protocolScriptUtxo: UTxO;
  protocolGovernorPkh: PaymentKeyHash;
};

export function cancelProposalTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    protocolProposalUtxo,
    protocolScriptUtxo,
    protocolGovernorPkh,
  }: CancelTxParams
) {
  // TODO: @sk-umiuma: Implement this
  const redeemer: Redeemer = Data.empty();

  const tx = lucid
    .newTx()
    .addSigner(protocolGovernorPkh)
    .readFrom([protocolParamsUtxo, protocolScriptUtxo])
    .collectFrom([protocolProposalUtxo], redeemer)
    .payToContract(
      protocolProposalUtxo.address,
      { inline: Data.empty() },
      protocolProposalUtxo.assets
    );

  return tx;
}
