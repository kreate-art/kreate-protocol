import { Assets, Lucid, generateSeedPhrase } from "lucid-cardano";

//https://github.com/spacebudz/nebula/blob/main/contract/tests/mod.test.ts#L17
export async function generateAccount() {
  const assets: Assets = { lovelace: 30000000000n };

  const seedPhrase = generateSeedPhrase();
  return {
    seedPhrase,
    address: await (await Lucid.new(undefined, "Custom"))
      .selectWalletFromSeed(seedPhrase)
      .wallet.address(),
    assets,
  };
}
