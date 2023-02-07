import { Lucid, UTxO } from "lucid-cardano";

import { constructTxOutputId, parseProtocolParams } from "@/helpers/schema";
import * as S from "@/schema";
import {
  DedicatedTreasuryRedeemer,
  OpenTreasuryDatum,
} from "@/schema/teiki/treasury";
import {
  RATIO_MULTIPLIER,
  TREASURY_REVOKE_DISCOUNT_CENTS,
} from "@/transactions/constants";
import { assert } from "@/utils";
import { scriptHashToAddress } from "tests/emulator";
import { MIN_UTXO_LOVELACE } from "tests/utils";

export type Actor = "protocol-governor" | "anyone";

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

  const { protocolParams } = parseProtocolParams(
    S.fromCbor(protocolParamsUtxo.datum)
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

  const openTreasuryVScriptAddress = scriptHashToAddress(
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
