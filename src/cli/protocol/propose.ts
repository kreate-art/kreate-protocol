import { Unit } from "lucid-cardano";

import { getLucid } from "@/commands/utils";
import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { signAndSubmit } from "@/helpers/lucid";
import * as S from "@/schema";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { proposeProtocolProposalTx } from "@/transactions/protocol/propose";
import { assert, trimToSlot } from "@/utils";

const lucid = await getLucid();

const currentProtocolNftMph =
  "9d7131452013812e04286af09ebaf924ad932235c3954e201b53d248";

const proposalNftUnit: Unit =
  currentProtocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL;
const protocolProposalVAddress =
  "addr1x9mmyfwywydc9vd0d492q6e30v4klsl8jxujswggsev638u3vlcsl0ly744yql5jglwk30tesl9vfhx422qfcepyjasq66m6kd";

const protocolParamsUtxo = (
  await lucid.utxosByOutRef([
    {
      txHash:
        "f6dd36430401694145a53104d8f8efaac9196b881d93833e033719e97157c3ad",
      outputIndex: 0,
    },
  ])
)[0];

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

assert(
  protocolParamsUtxo.datum != null,
  "Invalid protocol params UTxO: Missing inline datum"
);

const currentProtocolParams = S.fromData(
  S.fromCbor(protocolParamsUtxo.datum),
  ProtocolParamsDatum
);

const proposedProtocolParamsDatum: ProtocolParamsDatum = {
  ...currentProtocolParams,
  projectPledge: 30_000_000n,
};
const txValidUntil = trimToSlot(Date.now()) + 600_000; // wait for 10 minutes

const tx = proposeProtocolProposalTx(lucid, {
  protocolParamsUtxo,
  proposedProtocolParamsDatum,
  protocolProposalUtxo,
  protocolProposalRefScriptUtxo,
  txValidUntil,
});

const txComplete = await tx.complete();
const txHash = await signAndSubmit(txComplete);

await lucid.awaitTx(txHash);

console.log("txHash :>> ", txHash);
