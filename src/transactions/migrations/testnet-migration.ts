import { Address, Lucid, UTxO, Unit } from "lucid-cardano";

import { Hex } from "@/types";
import { assert } from "@/utils";

export type MigrateParams = {
  migrateTokenUnit: Unit;
  migrateTokenAmount: bigint;
  migrateTokenPolicyRefUtxo: UTxO;
  validatorUtxos: UTxO[];
  currentValidatorRefUtxo: UTxO;
  validatorRedeemer: Hex;
  protocolParamsUtxo: UTxO;
  newValidatorAddress: Address;
};

export function migrateBackingTx(
  lucid: Lucid,
  {
    migrateTokenUnit,
    migrateTokenAmount,
    migrateTokenPolicyRefUtxo,
    validatorUtxos,
    currentValidatorRefUtxo,
    validatorRedeemer,
    protocolParamsUtxo,
    newValidatorAddress,
  }: MigrateParams
) {
  const tx = lucid
    .newTx()
    .readFrom([
      currentValidatorRefUtxo,
      protocolParamsUtxo,
      migrateTokenPolicyRefUtxo,
    ])
    .mintAssets({ [migrateTokenUnit]: migrateTokenAmount });

  for (const validatorUtxo of validatorUtxos) {
    assert(
      validatorUtxo.datum != null,
      "Invalid validator UTxO: Missing inline datum"
    );

    tx.collectFrom([validatorUtxo], validatorRedeemer).payToContract(
      newValidatorAddress,
      { inline: validatorUtxo.datum },
      { ...validatorUtxo.assets }
    );
  }

  return tx;
}
