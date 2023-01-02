import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  ProtocolParamsDatum,
  ProtocolProposalDatum,
  ProtocolProposalRedeemer,
} from "@/schema/teiki/protocol";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

import {
  constructTxOutputId,
  extractPaymentPubKeyHash,
} from "../helpers/constructors";
import { getCurrentTime } from "../helpers/lucid";

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

  const protocolGovernorPkh = extractPaymentPubKeyHash(
    protocolParamsDatum.governorAddress
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
      base: constructTxOutputId(protocolParamsUtxo),
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
