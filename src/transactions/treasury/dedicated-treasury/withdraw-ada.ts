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
  DedicatedTreasuryDatum,
  DedicatedTreasuryRedeemer,
} from "@/schema/teiki/treasury";
import {
  RATIO_MULTIPLIER,
  TREASURY_UTXO_MIN_ADA,
  TREASURY_WITHDRAWAL_DISCOUNT_RATIO,
} from "@/transactions/constants";
import { assert } from "@/utils";

export type Actor = "protocol-governor" | "anyone";

export type Params = {
  protocolParamsUtxo: UTxO;
  // Not need to reference project UTxO in case of initiate or cancel delist
  projectUtxo?: UTxO;
  dedicatedTreasuryUtxos: UTxO[];
  dedicatedTreasuryVRefScriptUtxo: UTxO;
  actor: Actor;
};

export function withdrawAdaTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    dedicatedTreasuryUtxos,
    dedicatedTreasuryVRefScriptUtxo,
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

  let tx = lucid.newTx();
  tx = projectUtxo
    ? tx.readFrom([
        protocolParamsUtxo,
        dedicatedTreasuryVRefScriptUtxo,
        projectUtxo,
      ])
    : tx.readFrom([protocolParamsUtxo, dedicatedTreasuryVRefScriptUtxo]);

  const minRemainingAda =
    (1n + protocolParams.minTreasuryPerMilestoneEvent) * TREASURY_UTXO_MIN_ADA;

  const dedicatedTreasuryRedeemer = S.toCbor(
    S.toData({ case: "WithdrawAda" }, DedicatedTreasuryRedeemer)
  );

  for (const dedicatedTreasuryUTxO of dedicatedTreasuryUtxos) {
    assert(
      dedicatedTreasuryUTxO.datum != null,
      "Invalid open treasury UTxO: Missing inline datum"
    );
    const dedicatedTreasuryDatum = S.fromData(
      S.fromCbor(dedicatedTreasuryUTxO.datum),
      DedicatedTreasuryDatum
    );

    const spendingAda = BigInt(dedicatedTreasuryUTxO.assets.lovelace);
    const governorAda = dedicatedTreasuryDatum.governorAda;
    const withdrawAda =
      governorAda < spendingAda - minRemainingAda
        ? governorAda
        : spendingAda - minRemainingAda;

    const outputDatum: DedicatedTreasuryDatum = {
      projectId: dedicatedTreasuryDatum.projectId,
      governorAda: governorAda - withdrawAda,
      tag: {
        kind: "TagContinuation",
        former: constructTxOutputId(dedicatedTreasuryUTxO),
      },
    };

    tx = tx
      .collectFrom([dedicatedTreasuryUTxO], dedicatedTreasuryRedeemer)
      .payToContract(
        dedicatedTreasuryUTxO.address,
        {
          inline: S.toCbor(S.toData(outputDatum, DedicatedTreasuryDatum)),
        },
        { lovelace: spendingAda - withdrawAda }
      );
    if (actor === "protocol-governor") {
      assert(withdrawAda > 0n, "Withdraw ADA amount must be larger than zero");
      tx = tx.addSignerKey(protocolGovernorPkh);
    } else {
      assert(
        withdrawAda > TREASURY_UTXO_MIN_ADA,
        "Withdraw ADA amount must be large than min UTxO ADA"
      );

      const outputGovernorDatum: UserTag = {
        kind: "TagTreasuryWithdrawal",
        treasuryOutputId: constructTxOutputId(dedicatedTreasuryUTxO),
      };

      tx = tx.payToAddressWithData(
        deconstructAddress(lucid, protocolParams.governorAddress),
        { inline: S.toCbor(S.toData(outputGovernorDatum, UserTag)) },
        {
          lovelace:
            (withdrawAda *
              (RATIO_MULTIPLIER - TREASURY_WITHDRAWAL_DISCOUNT_RATIO)) /
            RATIO_MULTIPLIER,
        }
      );
    }
  }

  return tx;
}
