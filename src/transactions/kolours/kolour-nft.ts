/* eslint-disable @typescript-eslint/no-explicit-any */
import equal from "deep-equal";
import {
  Lucid,
  UTxO,
  UnixTime,
  C,
  Core,
  fromHex,
  fromText,
} from "lucid-cardano";

import { getPaymentKeyHash } from "@/helpers/lucid";
import { fromJson } from "@/json";
import * as S from "@/schema";
import {
  KolourNftMintingRedeemer,
  KolourQuotation,
} from "@/schema/teiki/kolours";
import { Hex } from "@/types";
import { assert } from "@/utils";

import { KOLOUR_TX_MAX_DURATION } from "./constants";

export type MintKolourNftTxParams = {
  quotation: KolourQuotation;
  kolourNftRefScriptUtxo: UTxO;
  producerPkh: Hex;
  txTimeStart: UnixTime;
  txTimeEnd: UnixTime;
};

export type VerifyKolourNftTxParams = {
  tx: Core.Transaction;
  quotation: KolourQuotation;
  kolourNftMph: Hex;
  txId?: Hex;
  txBody?: Core.TransactionBody;
  txExp?: UnixTime;
};

export function buildMintKolourNftTx(
  lucid: Lucid,
  {
    quotation,
    kolourNftRefScriptUtxo,
    producerPkh,
    txTimeStart,
    txTimeEnd,
  }: MintKolourNftTxParams
) {
  assert(
    kolourNftRefScriptUtxo.scriptRef != null,
    "Invalid kolour nft script UTxO: Missing script reference"
  );

  const kolourNftMph = lucid.utils.validatorToScriptHash(
    kolourNftRefScriptUtxo.scriptRef
  );
  const { kolours, userAddress, feeAddress, referral, expiration } = quotation;
  let tx = lucid.newTx().readFrom([kolourNftRefScriptUtxo]);

  let totalMintFees = 0n;
  const nftMetadata = new Map();
  for (const [kolourHex, { fee, image }] of Object.entries(kolours)) {
    const kolourName = `#${kolourHex.toUpperCase()}`;
    const kolourNftUnit = kolourNftMph + fromText(kolourName);
    const metadatum = {
      name: kolourName,
      image,
      mediaType: "image/png",
      description: `The Kolour ${kolourName} in the Kreataverse`,
    };

    nftMetadata.set(
      kolourName,
      referral ? { ...metadatum, referral } : metadatum
    );

    tx = tx
      .mintAssets(
        { [kolourNftUnit]: 1n },
        S.toCbor(S.toData({ case: "Mint" }, KolourNftMintingRedeemer))
      )
      .payToAddress(userAddress, { [kolourNftUnit]: 1n });

    totalMintFees += BigInt(fee);
  }

  const metadata = {
    [kolourNftMph]: Object.fromEntries(nftMetadata),
  };

  return tx
    .addSigner(userAddress)
    .addSignerKey(producerPkh)
    .attachMetadata(721, metadata)
    .payToAddress(feeAddress, { lovelace: totalMintFees })
    .validFrom(txTimeStart)
    .validTo(
      Math.min(
        txTimeEnd,
        txTimeStart + Number(KOLOUR_TX_MAX_DURATION),
        expiration
      )
    );
}

export function verifyKolourNftMintingTx(
  lucid: Lucid,
  { tx, quotation, kolourNftMph, txId, txBody, txExp }: VerifyKolourNftTxParams
) {
  const { kolours, userAddress, feeAddress, referral, expiration } = quotation;

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

  const kolourNftMetadataObj = fromJson(
    C.decode_metadatum_to_json_str(
      nftMetadata,
      C.MetadataJsonSchema.NoConversions
    )
  );
  assert(
    kolourNftMetadataObj != null && typeof kolourNftMetadataObj === "object",
    "Invalid metadata"
  );

  const kolourNftMetadata = (kolourNftMetadataObj as any)[kolourNftMph]; // hex

  const mintedValue = body.mint()?.to_json();
  assert(mintedValue, "Transaction does not mint any value");

  const mintedKolours = JSON.parse(mintedValue)[kolourNftMph];

  assert(
    Object.keys(mintedKolours).length == Object.keys(kolours).length,
    "Invalid minted value"
  );

  let totalMintFee = 0n;
  const constructedNftMetadatum = new Map();
  for (const [kolourHex, { fee, image }] of Object.entries(kolours)) {
    const kolourName = `#${kolourHex.toUpperCase()}`;
    assert(
      mintedKolours[fromText(kolourName)],
      `Missing ${kolourName} kolour NFT `
    );
    totalMintFee += BigInt(fee);

    const metadatum = {
      name: kolourName,
      image,
      mediaType: "image/png",
      description: `The Kolour ${kolourName} in the Kreataverse`,
    };

    constructedNftMetadatum.set(
      kolourName,
      referral ? { ...metadatum, referral } : metadatum
    );
  }

  const constructedMetadata = Object.fromEntries(constructedNftMetadatum);
  assert(
    equal(kolourNftMetadata, constructedMetadata),
    "Invalid kolour nft metadata"
  );

  assert(
    JSON.parse(body.outputs().to_json()).some(
      (o: any) =>
        o.address === feeAddress && BigInt(o.amount.coin) === totalMintFee
    ),
    "Incorrect fee"
  );
}

export function buildBurnKolourNftTx(
  lucid: Lucid,
  {
    kolours,
    kolourNftRefScriptUtxo,
  }: { kolours: Hex[]; kolourNftRefScriptUtxo: UTxO }
) {
  assert(
    kolourNftRefScriptUtxo.scriptRef != null,
    "Invalid kolour nft script UTxO: Missing script reference"
  );

  const kolourNftMph = lucid.utils.validatorToScriptHash(
    kolourNftRefScriptUtxo.scriptRef
  );
  let tx = lucid.newTx().readFrom([kolourNftRefScriptUtxo]);

  for (const kolour of kolours) {
    tx = tx.mintAssets(
      { [kolourNftMph + kolour]: -1n },
      S.toCbor(S.toData({ case: "Burn" }, KolourNftMintingRedeemer))
    );
  }

  return tx;
}
