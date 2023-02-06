import { Lucid, UTxO } from "lucid-cardano";

import {
  constructTxOutputId,
  deconstructAddress,
  extractPaymentPubKeyHash,
  parseProtocolParams,
} from "@/helpers/schema";
import * as S from "@/schema";
import { UserTag } from "@/schema/teiki/tags";
import {
  OpenTreasuryDatum,
  OpenTreasuryRedeemer,
} from "@/schema/teiki/treasury";
import {
  RATIO_MULTIPLIER,
  TREASURY_UTXO_MIN_ADA,
  TREASURY_WITHDRAWAL_DISCOUNT_RATIO,
} from "@/transactions/constants";
import { assert } from "@/utils";

// TODO: @sk-saru should it be a util type
export type Actor = "protocol-governor" | "anyone";

export type Params = {
  protocolParamsUtxo: UTxO;
  openTreasuryUtxos: UTxO[];
  openTreasuryVRefScriptUtxo: UTxO;
  actor: Actor;
};

export function withdrawAdaTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    openTreasuryUtxos,
    openTreasuryVRefScriptUtxo,
    actor,
  }: Params
) {
  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );

  const { protocolParams } = parseProtocolParams(
    S.fromCbor(protocolParamsUtxo.datum)
  );

  const protocolGovernorPkh = extractPaymentPubKeyHash(
    protocolParams.governorAddress
  );

  const openTreasuryRedeemer = S.toCbor(
    S.toData({ case: "WithdrawAda" }, OpenTreasuryRedeemer)
  );

  let tx = lucid
    .newTx()
    .readFrom([protocolParamsUtxo, openTreasuryVRefScriptUtxo]);

  let totalInG = 0n;
  let totalInW = 0n;
  for (const openTreasuryUtxo of openTreasuryUtxos) {
    assert(
      openTreasuryUtxo.datum != null,
      "Invalid open treasury UTxO: Missing inline datum"
    );

    tx = tx.collectFrom([openTreasuryUtxo], openTreasuryRedeemer);
    const openTreasuryDatum = S.fromData(
      S.fromCbor(openTreasuryUtxo.datum),
      OpenTreasuryDatum
    );

    const inW = BigInt(openTreasuryUtxo.assets.lovelace);
    totalInW += inW;

    const maxGovernorAdaWithZero =
      openTreasuryDatum.governorAda > 0n ? openTreasuryDatum.governorAda : 0n;
    const inG = maxGovernorAdaWithZero < inW ? maxGovernorAdaWithZero : inW;
    totalInG += inG;
  }

  const outW = totalInW - totalInG;

  const spendingTxOutputId = constructTxOutputId(
    ascSortUTxOByOutputId(openTreasuryUtxos)[0]
  );

  const outputOpenTreasuryDatum: OpenTreasuryDatum = {
    governorAda: 0n,
    tag: {
      kind: "TagContinuation",
      former: spendingTxOutputId,
    },
  };

  tx = tx.payToContract(
    openTreasuryUtxos[0].address,
    {
      inline: S.toCbor(S.toData(outputOpenTreasuryDatum, OpenTreasuryDatum)),
    },
    { lovelace: outW }
  );

  if (actor === "protocol-governor") {
    tx = tx.addSignerKey(protocolGovernorPkh);
    return tx;
  }

  const delta = totalInG;
  assert(
    delta >= TREASURY_UTXO_MIN_ADA,
    "Invalid output open treasury UTxO: require covering min ADA"
  );

  const outputGovernorDatum: UserTag = {
    kind: "TagTreasuryWithdrawal",
    treasuryOutputId: spendingTxOutputId,
  };

  return tx.payToAddressWithData(
    deconstructAddress(lucid, protocolParams.governorAddress),
    { inline: S.toCbor(S.toData(outputGovernorDatum, UserTag)) },
    {
      lovelace:
        (delta * (RATIO_MULTIPLIER - TREASURY_WITHDRAWAL_DISCOUNT_RATIO)) /
        RATIO_MULTIPLIER,
    }
  );
}

//https://www.hyperion-bt.org/helios-book/lang/builtins/txoutputid.html
export function ascSortUTxOByOutputId(utxos: UTxO[]) {
  return utxos.sort((o1, o2) => {
    if (o1.txHash == o2.txHash) return o1.outputIndex > o2.outputIndex ? 1 : -1;

    return o1.txHash > o2.txHash ? 1 : -1;
  });
}
