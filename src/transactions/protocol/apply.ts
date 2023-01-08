import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  ProtocolParamsDatum,
  ProtocolParamsRedeemer,
  ProtocolProposalDatum,
  ProtocolProposalRedeemer,
} from "@/schema/teiki/protocol";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

import { getCurrentTime } from "../../helpers/lucid";
import { extractPaymentPubKeyHash } from "../../helpers/schema";

export type ApplyProtocolTxParams = {
  protocolParamsUtxo: UTxO;
  protocolProposalUtxo: UTxO;
  protocolScriptUtxos: UTxO[];
  txTimePadding?: TimeDifference;
};

export function applyProtocolProposalTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    protocolProposalUtxo,
    protocolScriptUtxos,
    txTimePadding = 20000,
  }: ApplyProtocolTxParams
) {
  assert(protocolParamsUtxo.datum, "Protocol params utxo must have datum");
  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  assert(protocolProposalUtxo.datum, "Protocol proposal utxo must have datum");
  const protocolProposalDatum = S.fromData(
    S.fromCbor(protocolProposalUtxo.datum),
    ProtocolProposalDatum
  );

  assert(protocolProposalDatum.proposal, "Protocol proposal must not be empty");
  const appliedProtocolParamsDatum = protocolProposalDatum.proposal.params;

  const protocolGovernorPkh = extractPaymentPubKeyHash(
    protocolParams.governorAddress
  );

  return lucid
    .newTx()
    .addSignerKey(protocolGovernorPkh)
    .readFrom(protocolScriptUtxos)
    .collectFrom(
      [protocolParamsUtxo],
      S.toCbor(S.toData({ case: "ApplyProposal" }, ProtocolParamsRedeemer))
    )
    .collectFrom(
      [protocolProposalUtxo],
      S.toCbor(S.toData({ case: "Apply" }, ProtocolProposalRedeemer))
    )
    .payToContract(
      protocolProposalUtxo.address,
      { inline: S.toCbor(S.toData({ proposal: null }, ProtocolProposalDatum)) },
      protocolProposalUtxo.assets
    )
    .payToContract(
      protocolParamsUtxo.address,
      {
        inline: S.toCbor(
          S.toData(appliedProtocolParamsDatum, ProtocolParamsDatum)
        ),
      },
      protocolParamsUtxo.assets
    )
    .validFrom(getCurrentTime(lucid) - txTimePadding);
}
