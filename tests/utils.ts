import { fromText } from "lucid-cardano";

import { getMigratableScript } from "@/commands/gen-protocol-params";
import { Registry } from "@/schema/teiki/protocol";
import { Hex } from "@/types";

import { generateBlake2b224Hash } from "./emulator";

export function generateProtocolRegistry(
  protocolStakeValidatorHash: Hex
): Registry {
  const migrateTokenName = fromText("migration");

  return {
    protocolStakingValidator: { script: { hash: protocolStakeValidatorHash } },
    projectValidator: getMigratableScript(
      generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    projectDetailValidator: getMigratableScript(
      generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    projectScriptValidator: getMigratableScript(
      generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    backingValidator: getMigratableScript(
      generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    dedicatedTreasuryValidator: getMigratableScript(
      generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    sharedTreasuryValidator: getMigratableScript(
      generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
    openTreasuryValidator: getMigratableScript(
      generateBlake2b224Hash(),
      generateBlake2b224Hash(),
      migrateTokenName
    ),
  };
}
