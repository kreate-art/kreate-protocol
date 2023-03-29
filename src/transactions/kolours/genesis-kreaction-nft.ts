/* eslint-disable @typescript-eslint/no-explicit-any */
import equal from "deep-equal";
import {
  Core,
  Lucid,
  UTxO,
  UnixTime,
  fromText,
  C,
  Address,
} from "lucid-cardano";

import {
  extractWitnessKeyHashes,
  getUserAddressKeyHashes,
} from "@/helpers/lucid";
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
  receivedNftAddress?: Address;
};

export type VerifyGKNftTxParams = {
  tx: Core.Transaction;
  quotation: GenesisKreationQuotation;
  gkNftMph: Hex;
  name: string;
  description: string;
  // Act as an optimization
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
    receivedNftAddress,
  }: MintGKNftTxParams
) {
  const { id, image, fee, userAddress, feeAddress, referral, expiration } =
    quotation;

  assert(
    gkNftRefScriptUtxo.scriptRef != null,
    "Invalid genesis kreation nft script UTxO: Missing script reference"
  );
  const gkNftMph = lucid.utils.validatorToScriptHash(
    gkNftRefScriptUtxo.scriptRef
  );

  let tx = lucid.newTx().readFrom([gkNftRefScriptUtxo]);

  const { paymentKeyHash: userPkh, stakeKeyHash: userSkh } =
    getUserAddressKeyHashes(userAddress);
  if (referral) {
    assert(userSkh, "Must use a stake key hash with referral");
    tx = tx.addSignerKey(userSkh);
  }

  const nftMetadata = new Map();
  const gkNftUnit = gkNftMph + fromText(id);

  nftMetadata.set(id, {
    name,
    image,
    mediaType: "image/png",
    description,
    ...(referral ? { referral: referral.id } : {}),
  });

  tx = tx
    .mintAssets(
      { [gkNftUnit]: 1n },
      S.toCbor(S.toData({ case: "Mint" }, KolourNftMintingRedeemer))
    )
    .payToAddress(receivedNftAddress ?? userAddress, { [gkNftUnit]: 1n });

  const metadatum = {
    [gkNftMph]: Object.fromEntries(nftMetadata),
  };

  return tx
    .addSignerKey(userPkh)
    .addSignerKey(producerPkh)
    .attachMetadata(721, metadatum)
    .payToAddress(feeAddress, { lovelace: BigInt(fee) })
    .validFrom(txTimeStart)
    .validTo(
      Math.min(
        txTimeEnd,
        txTimeStart + Number(KOLOUR_TX_MAX_DURATION),
        expiration * 1_000 // to timestamp
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
  txBody ??= tx.body();
  txId ??= C.hash_transaction(txBody).to_hex();
  if (!txExp) {
    const txEndSlot = txBody.ttl()?.to_str();
    if (txEndSlot) txExp = lucid.utils.slotToUnixTime(parseInt(txEndSlot));
  }
  assert(
    txExp && txExp <= expiration * 1000,
    "Invalid transaction time range upper bound"
  );

  const witnesses = tx.witness_set();
  const keyHashes = extractWitnessKeyHashes({ witnesses, txId });
  const { paymentKeyHash: userPkh, stakeKeyHash: userSkh } =
    getUserAddressKeyHashes(userAddress);
  assert(
    keyHashes.includes(userPkh) &&
      (!referral || (userSkh && keyHashes.includes(userSkh))),
    "Missing user's signatures"
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

  const mintedValue = txBody.mint()?.to_json();
  assert(mintedValue, "Transaction does not mint any value");

  const mintedGK = fromJson<any>(mintedValue)[gkNftMph];

  assert(Object.keys(mintedGK).length == 1, "Invalid minted value");

  const constructedNftMetadatum = new Map();
  assert(mintedGK[fromText(id)], `Missing ${id} NFT `);

  constructedNftMetadatum.set(id, {
    name,
    image,
    mediaType: "image/png",
    description,
    ...(referral ? { referral: referral.id } : {}),
  });

  const constructedMetadata = Object.fromEntries(constructedNftMetadatum);
  assert(
    equal(gkNftMetadata, constructedMetadata),
    "Invalid Genesis Kreation nft metadata"
  );

  assert(
    fromJson<any>(txBody.outputs().to_json()).some(
      (o: any) =>
        o.address === feeAddress && BigInt(o.amount.coin) === BigInt(fee)
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
