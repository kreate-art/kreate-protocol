import {
  Lucid,
  ScriptHash,
  Address,
  AddressDetails,
  getAddressDetails,
  TxComplete,
  Core,
  fromHex,
} from "lucid-cardano";

import { Hex } from "@/types";
import { assert } from "@/utils";

export async function signAndSubmit(tx: TxComplete): Promise<Hex> {
  const signedTx = await tx.sign().complete();
  const txId = await signedTx.submit();
  return txId;
}

export function getPaymentKeyHash(address: Address): Hex {
  const { paymentCredential } = getAddressDetails(address);
  assert(paymentCredential, "Cannot extract payment credential from address");
  assert(paymentCredential.type === "Key", "Not a key hash payment credential");
  return paymentCredential.hash;
}

export function getUserAddressKeyHashes(address: Address) {
  const { paymentCredential, stakeCredential } = getAddressDetails(address);
  assert(
    paymentCredential && paymentCredential.type === "Key",
    "Cannot extract payment key hash from address"
  );
  return {
    paymentKeyHash: paymentCredential.hash,
    stakeKeyHash:
      stakeCredential && stakeCredential.type === "Key"
        ? stakeCredential.hash
        : null,
  };
}

export function getAddressDetailsSafe(address: Address): AddressDetails | null {
  try {
    return getAddressDetails(address);
  } catch (e) {
    if (e instanceof Error && e.message.includes("No address type matched for"))
      return null;
    throw e;
  }
}

export function addressFromScriptHashes(
  lucid: Lucid,
  paymentScriptHash: ScriptHash,
  stakeScriptHash?: ScriptHash
): Address {
  return stakeScriptHash
    ? lucid.utils.credentialToAddress(
        lucid.utils.scriptHashToCredential(paymentScriptHash),
        lucid.utils.scriptHashToCredential(stakeScriptHash)
      )
    : lucid.utils.credentialToAddress(
        lucid.utils.scriptHashToCredential(paymentScriptHash)
      );
}

// https://github.com/spacebudz/lucid/blob/2d73e7d71d180c3aab7db654f3558279efb5dbb5/src/provider/emulator.ts#L280
export function extractWitnessKeyHashes({
  txId,
  witnesses,
}: {
  txId: Hex;
  witnesses: Core.TransactionWitnessSet;
}) {
  const vkeys = witnesses.vkeys();
  if (!vkeys) return [];
  const keyHashes = [];
  for (let i = 0, n = vkeys.len(); i < n; i++) {
    const witness = vkeys.get(i);
    const publicKey = witness.vkey().public_key();
    const keyHash = publicKey.hash().to_hex();
    if (!publicKey.verify(fromHex(txId), witness.signature()))
      throw new Error(`Invalid vkey witness. Key hash: ${keyHash}`);
    keyHashes.push(keyHash);
  }
  return keyHashes;
}
