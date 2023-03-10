import { Address, Lucid, PolicyId, Script, Unit, UTxO } from "lucid-cardano";

import { TEIKI_PLANT_NFT_TOKEN_NAME } from "@/contracts/common/constants";
import * as S from "@/schema";
import {
  TeikiPlantDatum,
  TeikiPlantNftMintingRedeemer,
} from "@/schema/teiki/meta-protocol";
import { TimeDifference } from "@/types";

export type BootstrapMetaProtocolTxParams = {
  seedUtxo: UTxO;
  teikiPlantDatum: TeikiPlantDatum;
  teikiPlantNftPolicy: Script;
  teikiPlantAddress: Address;
  txTime: TimeDifference;
  txTtl?: TimeDifference;
};

export function bootstrapMetaProtocolTx(
  lucid: Lucid,
  {
    teikiPlantDatum,
    seedUtxo,
    teikiPlantNftPolicy,
    teikiPlantAddress,
    txTime,
    txTtl = 600_000,
  }: BootstrapMetaProtocolTxParams
) {
  const teikiPlantNftPolicyId: PolicyId =
    lucid.utils.mintingPolicyToId(teikiPlantNftPolicy);
  const teikiPlantNftUnit: Unit =
    teikiPlantNftPolicyId + TEIKI_PLANT_NFT_TOKEN_NAME;

  return lucid
    .newTx()
    .collectFrom([seedUtxo])
    .mintAssets(
      { [teikiPlantNftUnit]: 1n },
      S.toCbor(S.toData({ case: "Bootstrap" }, TeikiPlantNftMintingRedeemer))
    )
    .attachMintingPolicy(teikiPlantNftPolicy)
    .payToContract(
      teikiPlantAddress,
      { inline: S.toCbor(S.toData(teikiPlantDatum, TeikiPlantDatum)) },
      { [teikiPlantNftUnit]: 1n }
    )
    .validFrom(txTime)
    .validTo(txTime + txTtl);
}
