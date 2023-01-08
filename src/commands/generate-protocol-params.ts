import { Lucid, UTxO } from "lucid-cardano";

import { exportScript } from "@/contracts/compile";
import {
  MigratableScript,
  ProtocolNonScriptParams,
  Registry,
} from "@/schema/teiki/protocol";
import { Hex } from "@/types";

import { constructMigratableScript } from "../helpers/schema";

import {
  compileBackingVScript,
  compileDedicatedTreasuryVScript,
  compileOpenTreasuryVScript,
  compileProjectDetailVScript,
  compileProjectsAtScript,
  compileProjectScriptVScript,
  compileProjectVScript,
  compileProofOfBackingMpScript,
  compileProtocolNftScript,
  compileProtocolSvScript,
  compileSharedTreasuryVScript,
  compileTeikiMpScript,
} from "./compile-scripts";

export type RegistryScript = {
  protocolStakeValidatorHash: Hex;
  projectValidatorHash: Hex;
  projectDetailValidatorHash: Hex;
  projectScriptValidatorHash: Hex;
  backingValidatorHash: Hex;
  dedicatedTreasuryValidatorHash: Hex;
  sharedTreasuryValidatorHash: Hex;
  openTreasuryValidatorHash: Hex;
};

export function getProtocolRegistryScript(
  lucid: Lucid,
  seedUtxo: UTxO,
  teikiPlantNftMph: Hex
): RegistryScript {
  const protocolNftPolicy = exportScript(compileProtocolNftScript(seedUtxo));

  const protocolNftMph = lucid.utils.validatorToScriptHash(protocolNftPolicy);

  const projectsAuthTokenMph = lucid.utils.validatorToScriptHash(
    exportScript(compileProjectsAtScript(protocolNftMph))
  );

  const teikiMph = lucid.utils.validatorToScriptHash(
    exportScript(compileTeikiMpScript(teikiPlantNftMph))
  );

  const proofOfBackingMph = lucid.utils.validatorToScriptHash(
    exportScript(
      compileProofOfBackingMpScript(
        projectsAuthTokenMph,
        protocolNftMph,
        teikiMph
      )
    )
  );

  return {
    protocolStakeValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(compileProtocolSvScript(protocolNftMph))
    ),
    projectValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(compileProjectVScript(projectsAuthTokenMph, protocolNftMph))
    ),
    projectDetailValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileProjectDetailVScript(projectsAuthTokenMph, protocolNftMph)
      )
    ),
    projectScriptValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileProjectScriptVScript(projectsAuthTokenMph, protocolNftMph)
      )
    ),
    backingValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(compileBackingVScript(proofOfBackingMph, protocolNftMph))
    ),
    dedicatedTreasuryValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileDedicatedTreasuryVScript(projectsAuthTokenMph, protocolNftMph)
      )
    ),
    sharedTreasuryValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileSharedTreasuryVScript({
          projectsAuthTokenMph,
          protocolNftMph,
          teikiMph,
          proofOfBackingMph,
        })
      )
    ),
    openTreasuryValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(compileOpenTreasuryVScript(protocolNftMph))
    ),
  };
}

export function getMigratableScript(
  validatorHash: Hex,
  migrateTokenMph: Hex,
  migrateTokenName: string
): MigratableScript {
  return constructMigratableScript(validatorHash, {
    [validatorHash]: {
      mintingPolicyHash: migrateTokenMph,
      tokenName: migrateTokenName,
    },
  });
}

export function getProtocolRegistry(
  lucid: Lucid,
  seedUtxo: UTxO,
  teikiPlantNftMph: Hex,
  migrateTokenMph: Hex,
  migrateTokenName: string
): Registry {
  const registryScript: RegistryScript = getProtocolRegistryScript(
    lucid,
    seedUtxo,
    teikiPlantNftMph
  );

  return {
    protocolStakingValidator: {
      script: { hash: registryScript.protocolStakeValidatorHash },
    },
    projectValidator: getMigratableScript(
      registryScript.projectValidatorHash,
      migrateTokenMph,
      migrateTokenName
    ),
    projectDetailValidator: getMigratableScript(
      registryScript.projectDetailValidatorHash,
      migrateTokenMph,
      migrateTokenName
    ),
    projectScriptValidator: getMigratableScript(
      registryScript.projectScriptValidatorHash,
      migrateTokenMph,
      migrateTokenName
    ),
    backingValidator: getMigratableScript(
      registryScript.backingValidatorHash,
      migrateTokenMph,
      migrateTokenName
    ),
    dedicatedTreasuryValidator: getMigratableScript(
      registryScript.dedicatedTreasuryValidatorHash,
      migrateTokenMph,
      migrateTokenName
    ),
    sharedTreasuryValidator: getMigratableScript(
      registryScript.sharedTreasuryValidatorHash,
      migrateTokenMph,
      migrateTokenName
    ),
    openTreasuryValidator: getMigratableScript(
      registryScript.openTreasuryValidatorHash,
      migrateTokenMph,
      migrateTokenName
    ),
  };
}

// TODO: sk-saru should read from config file
export const SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS: ProtocolNonScriptParams = {
  governorShareRatio: 600_000n,
  protocolFundsShareRatio: 600_000n,
  discountCentPrice: 10_000n,
  projectMilestones: [1_000_000n, 10_000_000n, 100_000_000n],
  teikiCoefficient: 500n,
  projectTeikiBurnRate: 600_000n,
  epochLength: { milliseconds: 10_000n },
  projectPledge: 50_000_000n,
  projectCreationFee: 20_000_000n,
  projectSponsorshipFee: 10_000_000n,
  projectSponsorshipDuration: { milliseconds: 10_000n },
  projectInformationUpdateFee: 10_000_000n,
  projectCommunityUpdateFee: 10_000_000n,
  minTreasuryPerMilestoneEvent: 20_000_000n,
  stakeKeyDeposit: 2_000_000n,
  proposalWaitingPeriod: { milliseconds: 10_000n },
  projectDelistWaitingPeriod: { milliseconds: 10_000n },
};
