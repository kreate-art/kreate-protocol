import { fromText } from "lucid-cardano";

import { getMigratableScript } from "@/commands/gen-protocol-params";
import { Registry } from "@/schema/teiki/protocol";
import { Hex } from "@/types";

import { generateBlake2b224Hash } from "./emulator";

type ValidatorScriptHashRegistry = {
  project?: Hex;
  projectDetail?: Hex;
  projectScript?: Hex;
  backing?: Hex;
  dedicatedTreasury?: Hex;
  openTreasury?: Hex;
  sharedTreasury?: Hex;
};

export function generateProtocolRegistry(
  protocolStakeValidatorHash: Hex,
  validatorScriptHashRegistry?: ValidatorScriptHashRegistry
): Registry {
  const migrateTokenName = fromText("migration");

  return {
    protocolStakingValidator: { script: { hash: protocolStakeValidatorHash } },
    projectValidator: getMigratableScript(
      validatorScriptHashRegistry?.project
        ? validatorScriptHashRegistry?.project
        : generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    projectDetailValidator: getMigratableScript(
      validatorScriptHashRegistry?.projectDetail
        ? validatorScriptHashRegistry?.projectDetail
        : generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    projectScriptValidator: getMigratableScript(
      validatorScriptHashRegistry?.projectScript
        ? validatorScriptHashRegistry?.projectScript
        : generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    backingValidator: getMigratableScript(
      validatorScriptHashRegistry?.backing
        ? validatorScriptHashRegistry?.backing
        : generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    dedicatedTreasuryValidator: getMigratableScript(
      validatorScriptHashRegistry?.dedicatedTreasury
        ? validatorScriptHashRegistry?.dedicatedTreasury
        : generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    sharedTreasuryValidator: getMigratableScript(
      validatorScriptHashRegistry?.sharedTreasury
        ? validatorScriptHashRegistry?.sharedTreasury
        : generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    openTreasuryValidator: getMigratableScript(
      validatorScriptHashRegistry?.openTreasury
        ? validatorScriptHashRegistry?.openTreasury
        : generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
  };
}
