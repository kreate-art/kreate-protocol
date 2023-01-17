import { getLucid } from "@/commands/utils";
import { signAndSubmit } from "@/helpers/lucid";
import { applyProtocolProposalTx } from "@/transactions/protocol/apply";

const lucid = await getLucid();

const protocolParamsUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const protocolProposalUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const protocolProposalRefScriptUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const protocolParamsRefScriptUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const tx = applyProtocolProposalTx(lucid, {
  protocolParamsUtxo,
  protocolProposalUtxo,
  protocolScriptUtxos: [
    protocolParamsRefScriptUtxo,
    protocolProposalRefScriptUtxo,
  ],
});

const txComplete = await tx.complete();
const txHash = await signAndSubmit(txComplete);

await lucid.awaitTx(txHash);
console.log("txHash :>> ", txHash);
