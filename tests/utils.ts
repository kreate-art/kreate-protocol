import { TxComplete } from "lucid-cardano";

import { getMigratableScript } from "@/commands/generate-protocol-params";
import { Registry } from "@/schema/teiki/protocol";
import { MIN_UTXO_LOVELACE } from "@/transactions/constants";
import { Hex } from "@/types";

import { generateBlake2b224Hash } from "./emulator";

export type ValidatorScriptHashRegistry = {
  project?: Hex;
  projectDetail?: Hex;
  projectScript?: Hex;
  backing?: Hex;
  dedicatedTreasury?: Hex;
  openTreasury?: Hex;
  sharedTreasury?: Hex;
};

export function generateProtocolRegistry(
  protocolSvHash: Hex,
  validatorScriptHashRegistry?: ValidatorScriptHashRegistry
): Registry {
  return {
    protocolStakingValidator: { script: { hash: protocolSvHash } },
    projectValidator: getMigratableScript(
      validatorScriptHashRegistry?.project
        ? validatorScriptHashRegistry?.project
        : generateBlake2b224Hash()
    ),
    projectDetailValidator: getMigratableScript(
      validatorScriptHashRegistry?.projectDetail
        ? validatorScriptHashRegistry?.projectDetail
        : generateBlake2b224Hash()
    ),
    projectScriptValidator: getMigratableScript(
      validatorScriptHashRegistry?.projectScript
        ? validatorScriptHashRegistry?.projectScript
        : generateBlake2b224Hash()
    ),
    backingValidator: getMigratableScript(
      validatorScriptHashRegistry?.backing
        ? validatorScriptHashRegistry?.backing
        : generateBlake2b224Hash()
    ),
    dedicatedTreasuryValidator: getMigratableScript(
      validatorScriptHashRegistry?.dedicatedTreasury
        ? validatorScriptHashRegistry?.dedicatedTreasury
        : generateBlake2b224Hash()
    ),
    sharedTreasuryValidator: getMigratableScript(
      validatorScriptHashRegistry?.sharedTreasury
        ? validatorScriptHashRegistry?.sharedTreasury
        : generateBlake2b224Hash()
    ),
    openTreasuryValidator: getMigratableScript(
      validatorScriptHashRegistry?.openTreasury
        ? validatorScriptHashRegistry?.openTreasury
        : generateBlake2b224Hash()
    ),
  };
}

export function getRandomLovelaceAmount(max?: number) {
  const random = BigInt(Math.floor(Math.random() * (max ?? 1_000_000_000)));
  return random > MIN_UTXO_LOVELACE ? random : MIN_UTXO_LOVELACE;
}

export function printExUnits(tx: TxComplete) {
  const lines: string[] = [];
  const txCmp = tx.txComplete;
  const redeemers = txCmp.witness_set().redeemers();
  const fmt = Intl.NumberFormat("en-US").format;
  lines.push(`Tx Id    :: ${tx.toHash()}`);
  lines.push(`Tx Size  :: ${fmt(txCmp.to_bytes().length)}`);
  lines.push(`Tx Fee   :: ${fmt(BigInt(txCmp.body().fee().to_str()))}`);
  if (redeemers == null) {
    lines.push(`Ex Units :: ∅`);
  } else {
    const fmtExUnits = ({ mem, cpu }: { mem: bigint; cpu: bigint }) =>
      `{ Mem = ${fmt(mem)} | Cpu = ${fmt(cpu)} }`;

    const summary: { tag: string; index: bigint; mem: bigint; cpu: bigint }[] =
      [];
    for (let i = 0, n = redeemers.len(); i < n; i++) {
      const rdm = redeemers.get(i);
      const tag = REDEEMER_TAG_KIND[rdm.tag().kind()];
      const index = BigInt(rdm.index().to_str());
      const ex = rdm.ex_units();
      const mem = BigInt(ex.mem().to_str());
      const cpu = BigInt(ex.steps().to_str());
      summary.push({ tag, index, mem, cpu });
    }
    const total = { mem: 0n, cpu: 0n };
    for (const e of summary) {
      total.mem += e.mem;
      total.cpu += e.cpu;
    }
    lines.push(`Ex Units :: ${fmtExUnits(total)}`);
    for (const e of summary)
      lines.push(`  ${e.tag} ! ${e.index} ~ ${fmtExUnits(e)}`);
  }
  console.info(lines.join("\n"));
}

const REDEEMER_TAG_KIND = ["spend", "mint", "cert", "reward"];
