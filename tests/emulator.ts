import { Assets, Lucid, generateSeedPhrase } from "lucid-cardano";

async function headlessLucid(): Promise<Lucid> {
  return Lucid.new(undefined, "Custom");
}

const DEFAULT_LOVELACE_PER_ACCOUNT = 1_000_000_000_000n;

// https://github.com/spacebudz/nebula/blob/main/contract/tests/mod.test.ts#L17
export async function generateAccount(assets?: Assets) {
  const lucid = await headlessLucid();
  const seedPhrase = generateSeedPhrase();

  const lovelace = assets?.lovelace ?? DEFAULT_LOVELACE_PER_ACCOUNT;
  return {
    seedPhrase,
    address: await lucid.selectWalletFromSeed(seedPhrase).wallet.address(),
    assets: { ...assets, lovelace },
  };
}
