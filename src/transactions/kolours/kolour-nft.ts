/* eslint-disable @typescript-eslint/no-explicit-any */
import equal from "deep-equal";
import {
  Lucid,
  UTxO,
  UnixTime,
  C,
  Core,
  fromText,
  Address,
} from "lucid-cardano";

import {
  extractWitnessKeyHashes,
  getWalletAddressKeyHashes,
} from "@/helpers/lucid";
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
  receivedNftAddress?: Address;
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
    receivedNftAddress,
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
  const { paymentKeyHash: userPkh, stakeKeyHash: userSkh } =
    getWalletAddressKeyHashes(userAddress);
  let tx = lucid.newTx().readFrom([kolourNftRefScriptUtxo]);
  if (userSkh) tx = tx.addSignerKey(userSkh);

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
      .payToAddress(receivedNftAddress ?? userAddress, { [kolourNftUnit]: 1n });

    totalMintFees += BigInt(fee);
  }

  const metadata = {
    [kolourNftMph]: Object.fromEntries(nftMetadata),
  };

  return tx
    .addSignerKey(userPkh)
    .addSignerKey(producerPkh)
    .attachMetadata(721, metadata)
    .payToAddress(feeAddress, { lovelace: totalMintFees })
    .validFrom(txTimeStart)
    .validTo(
      Math.min(
        txTimeEnd,
        txTimeStart + Number(KOLOUR_TX_MAX_DURATION),
        expiration * 1_000 // to timestamp
      )
    );
}

export function verifyKolourNftMintingTx(
  lucid: Lucid,
  { tx, quotation, kolourNftMph, txId, txBody, txExp }: VerifyKolourNftTxParams
) {
  const { kolours, userAddress, feeAddress, referral, expiration } = quotation;
  const { paymentKeyHash: userPkh, stakeKeyHash: userSkh } =
    getWalletAddressKeyHashes(userAddress);
  const expirationTimestamp = expiration * 1_000;
  const body = txBody ? txBody : tx.body();
  const txHash = txId ? txId : C.hash_transaction(body).to_hex();
  const witnesses = tx.witness_set();
  const txTimeEnd = body.ttl()?.to_str();
  assert(
    (txExp && txExp < expirationTimestamp) ||
      (txTimeEnd &&
        lucid.utils.slotToUnixTime(parseInt(txTimeEnd)) < expirationTimestamp),
    "Invalid transaction time range upper bound"
  );

  const keyHashes = extractWitnessKeyHashes({ witnesses, txHash });
  assert(
    keyHashes.includes(userPkh) &&
      (!userSkh || (userSkh && keyHashes.includes(userSkh))),
    "Missing user's signatures"
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
