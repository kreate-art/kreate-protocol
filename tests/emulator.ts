import {
  Assets,
  Datum,
  DatumHash,
  Emulator,
  generateSeedPhrase,
  KeyHash,
  Lucid,
  OutRef,
  ScriptHash,
  toHex,
  UTxO,
} from "lucid-cardano";

import { assert } from "@/utils";

type Crypto = {
  getRandomValues<T extends ArrayBufferView | null>(array: T): T;
};

function loadCrypto(): Crypto {
  // global.crypto is loaded by Lucid
  const crypto = (global as unknown as Record<"crypto", Crypto | undefined>)
    .crypto;
  assert(crypto, "global.crypto is not loaded");
  return crypto;
}

async function headlessLucid(): Promise<Lucid> {
  return Lucid.new(undefined, "Custom");
}

const DEFAULT_LOVELACE_PER_ACCOUNT = 1_000_000_000_000n;

export async function generateWalletAddress() {
  const lucid = await headlessLucid();
  const seedPhrase = generateSeedPhrase();

  return await lucid.selectWalletFromSeed(seedPhrase).wallet.address();
}

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

export function generateOutRef(): OutRef {
  // 32 bytes for txHash, 1 byte for outputIndex
  const bytes = loadCrypto().getRandomValues(new Uint8Array(33));
  const txHash = toHex(bytes.slice(0, 32));
  const outputIndex = bytes[32];
  return { txHash, outputIndex };
}

function toLedgerFlatRef(ref: OutRef): string {
  return ref.txHash + ref.outputIndex;
}

export function attachUtxos(emulator: Emulator, utxos: UTxO[]): Emulator {
  emulator.ledger = {
    ...emulator.ledger,
    ...Object.fromEntries(
      utxos.map((utxo) => [toLedgerFlatRef(utxo), { utxo, spent: false }])
    ),
  };
  return emulator;
}

export function detachUtxos(emulator: Emulator, refs: OutRef[]): Emulator {
  const toDetach = new Set(refs.map(toLedgerFlatRef));
  emulator.ledger = Object.fromEntries(
    Object.entries(emulator.ledger).filter(
      ([flatRef, _]) => !toDetach.has(flatRef)
    )
  );
  return emulator;
}

export function spendUtxos(emulator: Emulator, refs: OutRef[]): Emulator {
  const toSpend = new Set(refs.map(toLedgerFlatRef));
  emulator.ledger = Object.fromEntries(
    Object.entries(emulator.ledger).map(([flatRef, { utxo, spent }]) => [
      flatRef,
      { utxo, spent: spent || toSpend.has(flatRef) },
    ])
  );
  return emulator;
}

export function unspendUtxos(emulator: Emulator, refs: OutRef[]): Emulator {
  const toUnspend = new Set(refs.map(toLedgerFlatRef));
  emulator.ledger = Object.fromEntries(
    Object.entries(emulator.ledger).map(([flatRef, { utxo, spent }]) => [
      flatRef,
      { utxo, spent: spent && !toUnspend.has(flatRef) },
    ])
  );
  return emulator;
}

export function attachDatums(
  emulator: Emulator,
  datums: Record<DatumHash, Datum>
): Emulator {
  emulator.datumTable = { ...emulator.datumTable, ...datums };
  return emulator;
}

export function generateBlake2b224Hash(): KeyHash | ScriptHash {
  return toHex(loadCrypto().getRandomValues(new Uint8Array(28)));
}
