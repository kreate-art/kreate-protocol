import { fromHex, Lucid, toHex, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import {
  ProtocolParamsDatum,
  ProtocolProposalDatum,
  ProtocolProposalRedeemer,
} from "@/schema/teiki/protocol";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

export type ProposeProtocolTxParams = {
  protocolParamsDatum: ProtocolParamsDatum;
  protocolParamsUtxo: UTxO;
  proposedProtocolParamsDatum: ProtocolParamsDatum;
  protocolProposalUtxo: UTxO;
  protocolProposalScriptUtxo: UTxO;
  txTimePadding?: TimeDifference;
};

export function proposeProtocolProposalTx(
  lucid: Lucid,
  {
    protocolParamsDatum,
    protocolParamsUtxo,
    proposedProtocolParamsDatum,
    protocolProposalUtxo,
    protocolProposalScriptUtxo,
    txTimePadding = 200000,
  }: ProposeProtocolTxParams
) {
  assert(
    protocolParamsDatum.governorAddress.paymentCredential.paymentType ===
      "PubKey",
    "Governor address must have a public-key hash credential"
  );
  const protocolGovernorPkh = toHex(
    protocolParamsDatum.governorAddress.paymentCredential.$.pubKeyHash.$hash
  );

  const txTimeEnd = Date.now() + txTimePadding;

  const protocolProposalDatum: ProtocolProposalDatum = {
    inner: {
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
