import {
  Address,
  AddressDetails,
  getAddressDetails,
  Lucid,
  TxComplete,
  Wallet,
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

export function getAddressDetailsSafe(address: Address): AddressDetails | null {
  try {
    return getAddressDetails(address);
  } catch (e) {
    if (e instanceof Error && e.message.includes("No address type matched for"))
      return null;
    throw e;
  }
}

export async function switchWallet(
  lucid: Lucid,
  fn: (original: Wallet) => void | Promise<void>
): Promise<void> {
  const original = lucid.wallet;
  try {
    await fn(original);
  } finally {
    lucid.wallet = original;
  }
}
