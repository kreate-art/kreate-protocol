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
