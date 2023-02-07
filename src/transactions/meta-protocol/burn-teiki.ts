import { Lucid, UTxO, Unit } from "lucid-cardano";

import { TEIKI_TOKEN_NAME } from "@/contracts/common/constants";
import * as S from "@/schema";
import { TeikiMintingRedeemer } from "@/schema/teiki/meta-protocol";
import { assert } from "@/utils";

export type Params = {
  teikiMpRefScriptUtxo: UTxO;
  burnAmount: bigint;
};

export function burnTeikiTx(
  lucid: Lucid,
  { teikiMpRefScriptUtxo, burnAmount }: Params
) {
  assert(
    teikiMpRefScriptUtxo.scriptRef != null,
    "Invalid teiki minting policy reference UTxO: must reference teiki minting policy script"
  );

  const teikiMph = lucid.utils.validatorToScriptHash(
    teikiMpRefScriptUtxo.scriptRef
  );

  const teikiUnit: Unit = teikiMph + TEIKI_TOKEN_NAME;

  return lucid
    .newTx()
    .readFrom([teikiMpRefScriptUtxo])
    .mintAssets(
      { [teikiUnit]: -burnAmount },
      S.toCbor(S.toData({ case: "Burn" }, TeikiMintingRedeemer))
    );
}
