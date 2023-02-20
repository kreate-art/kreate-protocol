import { Lucid, UTxO } from "lucid-cardano";

import { addressFromScriptHashes } from "@/helpers/lucid";
import { constructTxOutputId } from "@/helpers/schema";
import * as S from "@/schema";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import {
  DedicatedTreasuryRedeemer,
  OpenTreasuryDatum,
} from "@/schema/teiki/treasury";
import {
  MIN_UTXO_LOVELACE,
  RATIO_MULTIPLIER,
  TREASURY_REVOKE_DISCOUNT_CENTS,
} from "@/transactions/constants";
import { assert } from "@/utils";

export type Params = {
  protocolParamsUtxo: UTxO;
  // Not need to reference project UTxO in case of initiate or cancel delist
  projectUtxo?: UTxO;
  dedicatedTreasuryUtxos: UTxO[];
  dedicatedTreasuryVRefScriptUtxo: UTxO;
};

export function revokeTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    dedicatedTreasuryUtxos,
    dedicatedTreasuryVRefScriptUtxo,
  }: Params
) {
  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );

  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  let tx = lucid.newTx();
  tx = projectUtxo
    ? tx.readFrom([
        protocolParamsUtxo,
        dedicatedTreasuryVRefScriptUtxo,
        projectUtxo,
      ])
    : tx.readFrom([protocolParamsUtxo, dedicatedTreasuryVRefScriptUtxo]);

  const dedicatedTreasuryRedeemer = S.toCbor(
    S.toData({ case: "Revoke" }, DedicatedTreasuryRedeemer)
  );

  const openTreasuryVScriptAddress = addressFromScriptHashes(
    lucid,
    protocolParams.registry.openTreasuryValidator.latest.script.hash,
    protocolParams.registry.protocolStakingValidator.script.hash
  );

  for (const dedicatedTreasuryUTxO of dedicatedTreasuryUtxos) {
    assert(
      dedicatedTreasuryUTxO.datum != null,
      "Invalid open treasury UTxO: Missing inline datum"
    );

    tx = tx.collectFrom([dedicatedTreasuryUTxO], dedicatedTreasuryRedeemer);

    const spendingAda = BigInt(dedicatedTreasuryUTxO.assets.lovelace);
    const adaToTreasury =
      spendingAda -
      protocolParams.discountCentPrice * TREASURY_REVOKE_DISCOUNT_CENTS;

    if (adaToTreasury > 0n) {
      const treasuryAda =
        adaToTreasury > MIN_UTXO_LOVELACE ? adaToTreasury : MIN_UTXO_LOVELACE;
      const openTreasuryDatum: OpenTreasuryDatum = {
        governorAda:
          (treasuryAda * protocolParams.governorShareRatio) / RATIO_MULTIPLIER,
        tag: {
          kind: "TagContinuation",
          former: constructTxOutputId(dedicatedTreasuryUTxO),
        },
      };
      tx = tx.payToContract(
        openTreasuryVScriptAddress,
        {
          inline: S.toCbor(S.toData(openTreasuryDatum, OpenTreasuryDatum)),
        },
        { lovelace: treasuryAda }
      );
    }
  }

  return tx;
}
