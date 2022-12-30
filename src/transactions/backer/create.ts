import { Address, Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import { BackingDatum } from "@/schema/teiki/backer";

export type CreateBackingParams = {
  backingDatum: BackingDatum;
  // input wallet UTxOs must cover the backing amount
  backingLovelaceAmount: bigint;
  // backing credential + project stake credential
  backingScriptAddress: Address;
  inputWalletUTxOs: UTxO[];
};

export function createBackingTx(
  lucid: Lucid,
  {
    backingDatum,
    backingLovelaceAmount,
    backingScriptAddress,
    inputWalletUTxOs,
  }: CreateBackingParams
) {
  return lucid
    .newTx()
    .collectFrom(inputWalletUTxOs)
    .payToContract(
      backingScriptAddress,
      {
        inline: S.toCbor(S.toData(backingDatum, BackingDatum)),
      },
      { lovelace: backingLovelaceAmount }
    );
}
