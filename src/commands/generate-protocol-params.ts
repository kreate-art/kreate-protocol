import { Lucid } from "lucid-cardano";

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
  protocolNftMph: Hex,
  teikiPlantNftMph: Hex
): RegistryScript {
  const projectAtMph = lucid.utils.validatorToScriptHash(
    exportScript(compileProjectsAtScript(protocolNftMph))
  );

  const teikiMph = lucid.utils.validatorToScriptHash(
    exportScript(compileTeikiMpScript(teikiPlantNftMph))
  );

  const proofOfBackingMph = lucid.utils.validatorToScriptHash(
    exportScript(
      compileProofOfBackingMpScript(projectAtMph, protocolNftMph, teikiMph)
    )
  );

  return {
    protocolStakeValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(compileProtocolSvScript(protocolNftMph))
    ),
    projectValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(compileProjectVScript(projectAtMph, protocolNftMph))
    ),
    projectDetailValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(compileProjectDetailVScript(projectAtMph, protocolNftMph))
    ),
    projectScriptValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(compileProjectScriptVScript(projectAtMph, protocolNftMph))
    ),
    backingValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(compileBackingVScript(proofOfBackingMph, protocolNftMph))
    ),
    dedicatedTreasuryValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileDedicatedTreasuryVScript(projectAtMph, protocolNftMph)
      )
    ),
    sharedTreasuryValidatorHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileSharedTreasuryVScript({
          projectAtMph,
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
  protocolNftMph: Hex,
  teikiPlantNftMph: Hex,
  migrateTokenMph: Hex,
  migrateTokenName: string
): Registry {
  const registryScript: RegistryScript = getProtocolRegistryScript(
    lucid,
    protocolNftMph,
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
  // The Protocol Governor’s share of the protocol revenue (ADA & Teiki).
  // The ratio is represented by a [0..1] number multiplied by 1E+6.
  governorShareRatio: 800_000n, // 80%
  // The Protocol’s share (including Protocol Governor’s) share of the raised funds.
  // The ratio is represented by a [0..1] number multiplied by 1E+6.
  protocolFundsShareRatio: 45_000n, // 4.5%
  // The price per discount cent in Lovelace. Should be around 1E+4, to resemble a cent of an ADA. See Actors & Discounts.
  discountCentPrice: 10_000n,
  // Projects funding milestones in Lovelace.
  // Note that we can have a more compact format.
  projectMilestones: [
    1_500_000_000n,
    3_000_000_000n,
    6_000_000_000n,
    12_000_000_000n,
    25_000_000_000n,
    100_000_000_000n,
  ],
  // The r protocol parameter in @Teiki Tokenomics.
  teikiCoefficient: 500n,
  // The burn rate of projects' Teiki per epoch.
  // The rate is represented by a [0..1] number multiplied by 1E+6.
  projectTeikiBurnRate: 50_000n, // 5% per epoch
  // The length of an epoch in milliseconds - Cardano Protocol Params.
  epochLength: { milliseconds: 86_400_000n }, // 1 day / epoch -- preview
  projectPledge: 500_000_000n,
  projectCreationFee: 10_000_000n,
  // Minimum project sponsorship fee ADA (in Lovelace). Higher number, higher position.
  projectSponsorshipFee: 3_000_000_000n,
  // If the Project Owner paid the sponsorship fee, the project would be sponsored for this duration (in milliseconds).
  projectSponsorshipDuration: { milliseconds: 864_000_000n }, // 10 days
  projectInformationUpdateFee: 1_000_000n,
  projectCommunityUpdateFee: 500_000n,
  //The minimum number of shared treasuries need to be created (to receive Teiki) per milestone-reached event.
  minTreasuryPerMilestoneEvent: 10n,
  // The amount of ADA (in Lovelace) of a stake registration deposit - Cardano Protocol Params.
  stakeKeyDeposit: 2_000_000n,
  // Proposals have to go through a waiting period.
  proposalWaitingPeriod: { milliseconds: 20_000n }, // 1 block
  // Project delistings have to go through a waiting period. Initiated by Protocol Governor. Can be canceled during this period.
  projectDelistWaitingPeriod: { milliseconds: 20_000n }, // 1 block
};
