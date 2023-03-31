import { Unit } from "lucid-cardano";

import { getLucid } from "@/commands/utils";
import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { signAndSubmit } from "@/helpers/lucid";
import { applyProtocolProposalTx } from "@/transactions/protocol/apply";
import { trimToSlot } from "@/utils";

const lucid = await getLucid();

const protocolParamsUtxo = (
  await lucid.utxosByOutRef([
    {
      txHash:
        "f6dd36430401694145a53104d8f8efaac9196b881d93833e033719e97157c3ad",
      outputIndex: 0,
    },
  ])
)[0];

const currentProtocolNftMph =
  "9d7131452013812e04286af09ebaf924ad932235c3954e201b53d248";

const proposalNftUnit: Unit =
  currentProtocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL;
const protocolProposalVAddress =
  "addr1x9mmyfwywydc9vd0d492q6e30v4klsl8jxujswggsev638u3vlcsl0ly744yql5jglwk30tesl9vfhx422qfcepyjasq66m6kd";

const protocolProposalUtxo = (
  await lucid.utxosAtWithUnit(protocolProposalVAddress, proposalNftUnit)
)[0];
const protocolProposalRefScriptUtxo = (
  await lucid.utxosByOutRef([
    {
      txHash:
        "d0ab97ee21351ce9c70a3f1d5572b851dd5cd30cb58551a0bff7991123dd35d2",
      outputIndex: 4,
    },
  ])
)[0];

const protocolParamsRefScriptUtxo = (
  await lucid.utxosByOutRef([
    {
      txHash:
        "d0ab97ee21351ce9c70a3f1d5572b851dd5cd30cb58551a0bff7991123dd35d2",
      outputIndex: 3,
    },
  ])
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
