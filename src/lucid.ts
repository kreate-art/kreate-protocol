import {
  Address,
  Blockfrost,
  Lucid,
  Network,
  TxComplete,
  getAddressDetails,
} from "lucid-cardano";

import { Hex } from "@/types";

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (value) return value;
  else throw new Error(`${key} must be set`);
}

export async function getLucid(): Promise<Lucid> {
  // TODO: Extract this to another module
  const BLOCKFROST_URL = requiredEnv("BLOCKFROST_URL");
  const BLOCKFROST_PROJECT_ID = requiredEnv("BLOCKFROST_PROJECT_ID");
  const NETWORK = requiredEnv("NETWORK") as Network;
  const TEST_SEED_PHRASE_URL = process.env["TEST_SEED_PHRASE_URL"];

  const blockfrostProvider = new Blockfrost(
    BLOCKFROST_URL,
    BLOCKFROST_PROJECT_ID
  );
  const lucid = await Lucid.new(blockfrostProvider, NETWORK);
  if (TEST_SEED_PHRASE_URL)
    lucid.selectWalletFromSeed(decodeURIComponent(TEST_SEED_PHRASE_URL));
  return lucid;
}

export async function signAndSubmit(tx: TxComplete): Promise<Hex> {
  const signedTx = await tx.sign().complete();
  const txId = await signedTx.submit();
  return txId;
}

export function getPaymentKeyHash(address: Address): Hex {
  const addressDetails = getAddressDetails(address);
  if (!addressDetails.paymentCredential)
    throw new Error("Cannot extract payment key hash from address");
  return addressDetails.paymentCredential.hash;
}
