import { fromHex, Lucid, toHex, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  ProtocolParamsDatum,
  ProtocolProposalDatum,
  ProtocolProposalRedeemer,
} from "@/schema/teiki/protocol";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

import { getCurrentTime } from "../helpers/time";

export type ProposeProtocolTxParams = {
  protocolParamsUtxo: UTxO;
  proposedProtocolParamsDatum: ProtocolParamsDatum;
  protocolProposalUtxo: UTxO;
  protocolProposalScriptUtxo: UTxO;
  txTimePadding?: TimeDifference;
};

export function proposeProtocolProposalTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    proposedProtocolParamsDatum,
    protocolProposalUtxo,
    protocolProposalScriptUtxo,
    txTimePadding = 200000,
  }: ProposeProtocolTxParams
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

  const txTimeEnd = getCurrentTime(lucid) + txTimePadding;

  const protocolProposalDatum: ProtocolProposalDatum = {
    proposal: {
      inEffectAt: {
        timestamp:
          BigInt(txTimeEnd) +
          protocolParamsDatum.proposalWaitingPeriod.milliseconds +
          1n,
      },
      base: {
        txId: { $txId: fromHex(protocolParamsUtxo.txHash) },
        index: BigInt(protocolParamsUtxo.outputIndex),
      },
      params: proposedProtocolParamsDatum,
    },
  };

  return lucid
    .newTx()
    .addSignerKey(protocolGovernorPkh)
    .readFrom([protocolParamsUtxo, protocolProposalScriptUtxo])
    .collectFrom(
      [protocolProposalUtxo],
      S.toCbor(S.toData({ case: "Propose" }, ProtocolProposalRedeemer))
    )
    .payToContract(
      protocolProposalUtxo.address,
      {
        inline: S.toCbor(
          S.toData(protocolProposalDatum, ProtocolProposalDatum)
        ),
      },
      protocolProposalUtxo.assets
    )
    .validTo(txTimeEnd);
}
