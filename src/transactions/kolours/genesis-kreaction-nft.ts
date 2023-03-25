/* eslint-disable @typescript-eslint/no-explicit-any */
import equal from "deep-equal";
import {
  Core,
  Lucid,
  UTxO,
  UnixTime,
  fromText,
  C,
  fromHex,
} from "lucid-cardano";

import { getPaymentKeyHash } from "@/helpers/lucid";
import { fromJson } from "@/json";
import * as S from "@/schema";
import {
  GenesisKreationQuotation,
  KolourNftMintingRedeemer,
} from "@/schema/teiki/kolours";
import { Hex } from "@/types";
import { assert } from "@/utils";

import { KOLOUR_TX_MAX_DURATION } from "./constants";

export type MintGKNftTxParams = {
  quotation: GenesisKreationQuotation;
  gkNftRefScriptUtxo: UTxO;
  producerPkh: Hex;
  name: string;
  description: string;
  txTimeStart: UnixTime;
  txTimeEnd: UnixTime;
};

export type VerifyGKNftTxParams = {
  tx: Core.Transaction;
  quotation: GenesisKreationQuotation;
  gkNftMph: Hex;
  name: string;
  description: string;
  txId?: Hex;
  txBody?: Core.TransactionBody;
  txExp?: UnixTime;
};

export function buildMintGKNftTx(
  lucid: Lucid,
  {
    quotation,
    gkNftRefScriptUtxo,
    producerPkh,
    name,
    description,
    txTimeStart,
    txTimeEnd,
  }: MintGKNftTxParams
) {
  assert(
    gkNftRefScriptUtxo.scriptRef != null,
    "Invalid genesis kreation nft script UTxO: Missing script reference"
  );

  const gkNftMph = lucid.utils.validatorToScriptHash(
    gkNftRefScriptUtxo.scriptRef
  );
  const { id, image, fee, userAddress, feeAddress, referral, expiration } =
    quotation;
  let tx = lucid.newTx().readFrom([gkNftRefScriptUtxo]);

  const nftMetadata = new Map();
  const gkNftUnit = gkNftMph + fromText(id);
  const nftMetadatum = {
    name,
    image,
    mediaType: "image/png",
    description,
  };

  nftMetadata.set(id, referral ? { ...nftMetadatum, referral } : nftMetadatum);

  tx = tx
    .mintAssets(
      { [gkNftUnit]: 1n },
      S.toCbor(S.toData({ case: "Mint" }, KolourNftMintingRedeemer))
    )
    .payToAddress(userAddress, { [gkNftUnit]: 1n });

  const metadatum = {
    [gkNftMph]: Object.fromEntries(nftMetadata),
  };

  return tx
    .addSigner(userAddress)
    .addSignerKey(producerPkh)
    .attachMetadata(721, metadatum)
    .payToAddress(feeAddress, { lovelace: fee })
    .validFrom(txTimeStart)
    .validTo(
      Math.min(
        txTimeEnd,
        txTimeStart + Number(KOLOUR_TX_MAX_DURATION),
        expiration
      )
    );
}

export function verifyGKNftMintingTx(
  lucid: Lucid,
  {
    tx,
    quotation,
    gkNftMph,
    name,
    description,
    txId,
    txBody,
    txExp,
  }: VerifyGKNftTxParams
) {
  const { id, image, fee, userAddress, feeAddress, referral, expiration } =
    quotation;

  const body = txBody ? txBody : tx.body();
  const txHash = txId ? txId : C.hash_transaction(body).to_hex();
  const witnesses = tx.witness_set();
  const txTimeEnd = body.ttl()?.to_str();
  assert(
    (txExp && txExp < expiration) ||
      (txTimeEnd &&
        lucid.utils.slotToUnixTime(parseInt(txTimeEnd)) < expiration),
    "Invalid transaction time range upper bound"
  );

  //https://github.com/spacebudz/lucid/blob/2d73e7d71d180c3aab7db654f3558279efb5dbb5/src/provider/emulator.ts#L280
  const keyHashes = (() => {
    const keyHashes = [];
    for (let i = 0; i < (witnesses.vkeys()?.len() || 0); i++) {
      const witness = witnesses.vkeys()?.get(i);
      if (!witness) continue;
      const publicKey = witness.vkey().public_key();
      const keyHash = publicKey.hash().to_hex();

      if (!publicKey.verify(fromHex(txHash), witness.signature())) {
        throw new Error(`Invalid vkey witness. Key hash: ${keyHash}`);
      }
      keyHashes.push(keyHash);
    }
    return keyHashes;
  })();
  assert(
    keyHashes.some((keyHash) => keyHash === getPaymentKeyHash(userAddress)),
    "Missing user's signature"
  );

  const nftMetadata = tx
    .auxiliary_data()
    ?.metadata()
    ?.get(C.BigNum.from_str("721"));
  assert(nftMetadata, "Missing transaction nft metadata");

  const gkNftMetadataObj = fromJson(
    C.decode_metadatum_to_json_str(
      nftMetadata,
      C.MetadataJsonSchema.NoConversions
    )
  );
  assert(
    gkNftMetadataObj != null && typeof gkNftMetadataObj === "object",
    "Invalid metadata"
  );

  const gkNftMetadata = (gkNftMetadataObj as any)[gkNftMph]; // hex

  const mintedValue = body.mint()?.to_json();
  assert(mintedValue, "Transaction does not mint any value");

  const mintedGK = JSON.parse(mintedValue)[gkNftMph];

  assert(Object.keys(mintedGK).length == 1, "Invalid minted value");

  const constructedNftMetadatum = new Map();
  assert(mintedGK[fromText(id)], `Missing ${id} NFT `);

  const metadatum = {
    name,
    image,
    mediaType: "image/png",
    description,
  };

  constructedNftMetadatum.set(
    id,
    referral ? { ...metadatum, referral } : metadatum
  );

  const constructedMetadata = Object.fromEntries(constructedNftMetadatum);
  assert(
    equal(gkNftMetadata, constructedMetadata),
    "Invalid Genesis Kreation nft metadata"
  );

  assert(
    JSON.parse(body.outputs().to_json()).some(
      (o: any) => o.address === feeAddress && BigInt(o.amount.coin) === fee
    ),
    "Incorrect fee"
  );
}

export function buildBurnGKNftTx(
  lucid: Lucid,
  { ids, gkNftRefScriptUtxo }: { ids: Hex[]; gkNftRefScriptUtxo: UTxO }
) {
  assert(
    gkNftRefScriptUtxo.scriptRef != null,
    "Invalid Genesis Kcreation nft script UTxO: Missing script reference"
  );

  const gkNftMph = lucid.utils.validatorToScriptHash(
    gkNftRefScriptUtxo.scriptRef
  );
  let tx = lucid.newTx().readFrom([gkNftRefScriptUtxo]);

  for (const id of ids) {
    tx = tx.mintAssets(
      { [gkNftMph + fromText(id)]: -1n },
      S.toCbor(S.toData({ case: "Burn" }, KolourNftMintingRedeemer))
    );
  }

  return tx;
}
