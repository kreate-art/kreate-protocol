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
} from "../../helpers/schema";

export type ProposeProtocolTxParams = {
  protocolParamsUtxo: UTxO;
  proposedProtocolParamsDatum: ProtocolParamsDatum;
  protocolProposalUtxo: UTxO;
  protocolProposalRefScriptUtxo: UTxO;
  txValidUntil: TimeDifference;
};

export function proposeProtocolProposalTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    proposedProtocolParamsDatum,
    protocolProposalUtxo,
    protocolProposalRefScriptUtxo,
    txValidUntil,
  }: ProposeProtocolTxParams
) {
  assert(protocolParamsUtxo.datum, "Protocol params utxo must have datum");
  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  const protocolGovernorPkh = extractPaymentPubKeyHash(
    protocolParams.governorAddress
  );

  const protocolProposalDatum: ProtocolProposalDatum = {
    proposal: {
      inEffectAt: {
        timestamp:
          BigInt(txValidUntil) +
          protocolParams.proposalWaitingPeriod.milliseconds +
          1n,
      },
      base: constructTxOutputId(protocolParamsUtxo),
      params: proposedProtocolParamsDatum,
    },
  };

  return lucid
    .newTx()
    .addSignerKey(protocolGovernorPkh)
    .readFrom([protocolParamsUtxo, protocolProposalRefScriptUtxo])
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
    .validTo(txValidUntil);
}
