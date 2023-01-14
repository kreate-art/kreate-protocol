import { Lucid, Network, Blockfrost } from "lucid-cardano";

export async function getLucid(): Promise<Lucid> {
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

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (value) return value;
  else throw new Error(`${key} must be set`);
}
