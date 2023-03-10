import { Unit } from "lucid-cardano";

import { getLucid } from "@/commands/utils";
import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { signAndSubmit } from "@/helpers/lucid";
import { applyProtocolProposalTx } from "@/transactions/protocol/apply";
import { trimToSlot } from "@/utils";

const lucid = await getLucid();

const protocolParamsUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const currentProtocolNftMph =
  "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

const proposalNftUnit: Unit =
  currentProtocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL;
const protocolProposalVAddress = "addr_xxxxx";

const protocolProposalUtxo = (
  await lucid.utxosAtWithUnit(protocolProposalVAddress, proposalNftUnit)
)[0];
const protocolProposalRefScriptUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const protocolParamsRefScriptUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const txTime = trimToSlot(Date.now());

const tx = applyProtocolProposalTx(lucid, {
  protocolParamsUtxo,
  protocolProposalUtxo,
  protocolScriptUtxos: [
    protocolParamsRefScriptUtxo,
    protocolProposalRefScriptUtxo,
  ],
  txTime,
});

const txComplete = await tx.complete();
const txHash = await signAndSubmit(txComplete);

await lucid.awaitTx(txHash);
console.log("txHash :>> ", txHash);
