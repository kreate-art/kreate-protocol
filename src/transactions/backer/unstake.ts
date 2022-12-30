import { Lucid, UTxO, Assets, Address } from "lucid-cardano";

import * as S from "@/schema";
import {
  BackingDatum,
  BackingRedeemer,
  ProofOfBackingMintingRedeemer,
} from "@/schema/teiki/backer";
import { TeikiMintingRedeemer } from "@/schema/teiki/meta-protocol";

export type BackingOutputParams = {
  address: Address;
  assets: Assets;
  datum: BackingDatum;
};

export type ProducedBackerParams = {
  backingOutputParams: BackingOutputParams[];
  projectScriptUTxO: UTxO;
};

export type ProofOfBackingMintingParams = {
  assets: Assets;
  cleanup: boolean;
};

export type RefUTxOParams = {
  backingScript: UTxO;
  project: UTxO;
  proofOfBackingScript: UTxO;
  protocolParams: UTxO;
};

export type UnstakeParams = {
  consumedBackingUTxOs?: UTxO[]; // same project backings
  mintingTeikiAssets?: Assets;
  producedBackerParams?: ProducedBackerParams;
  proofOfBackingMintingParams: ProofOfBackingMintingParams;
  refUTxOParams: RefUTxOParams;
};

export function unstake(
  lucid: Lucid,
  {
    consumedBackingUTxOs,
    mintingTeikiAssets,
    producedBackerParams,
    proofOfBackingMintingParams,
    refUTxOParams,
  }: UnstakeParams
) {
  const proofOfBackingMintingRedeemer: ProofOfBackingMintingRedeemer = {
    case: "Plant",
    cleanup: proofOfBackingMintingParams.cleanup,
  };

  let tx = lucid
    .newTx()
    .readFrom(Object.values(refUTxOParams))
    .mintAssets(
      proofOfBackingMintingParams.assets,
      S.toCbor(
        S.toData(proofOfBackingMintingRedeemer, ProofOfBackingMintingRedeemer)
      )
    );

  if (mintingTeikiAssets) {
    const teikiMintingRedeemer: TeikiMintingRedeemer = { case: "Mint" };
    tx = tx.mintAssets(
      mintingTeikiAssets,
      S.toCbor(S.toData(teikiMintingRedeemer, TeikiMintingRedeemer))
    );
  }

  if (consumedBackingUTxOs) {
    const backingRedeemer: BackingRedeemer = { case: "Unstake" };

    tx = tx.collectFrom(
      consumedBackingUTxOs,
      S.toCbor(S.toData(backingRedeemer, BackingRedeemer))
    );
  }

  if (producedBackerParams) {
    tx = tx.readFrom([producedBackerParams.projectScriptUTxO]);

    for (const utxoParam of producedBackerParams.backingOutputParams) {
      tx = tx.payToContract(
        utxoParam.address,
        {
          inline: S.toCbor(S.toData(utxoParam.datum, BackingDatum)),
        },
        utxoParam.assets
      );
    }
  }

  return tx;
}
