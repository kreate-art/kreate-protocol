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
  compileProjectsAtMpScript,
  compileProjectScriptVScript,
  compileProjectVScript,
  compileProofOfBackingMpScript,
  compileProtocolSvScript,
  compileSharedTreasuryVScript,
  compileTeikiMpScript,
} from "./compile-scripts";

export type RegistryScript = {
  protocolSvHash: Hex;
  projectVHash: Hex;
  projectDetailVHash: Hex;
  projectScriptVHash: Hex;
  backingVHash: Hex;
  dedicatedTreasuryVHash: Hex;
  sharedTreasuryVHash: Hex;
  openTreasuryVHash: Hex;
};

export function getProtocolRegistryScript(
  lucid: Lucid,
  protocolNftMph: Hex,
  teikiPlantNftMph: Hex
): RegistryScript {
  const projectAtMph = lucid.utils.validatorToScriptHash(
    exportScript(compileProjectsAtMpScript({ protocolNftMph }))
  );

  const teikiMph = lucid.utils.validatorToScriptHash(
    exportScript(compileTeikiMpScript({ teikiPlantNftMph }))
  );

  const proofOfBackingMph = lucid.utils.validatorToScriptHash(
    exportScript(
      compileProofOfBackingMpScript({ projectAtMph, protocolNftMph, teikiMph })
    )
  );

  return {
    protocolSvHash: lucid.utils.validatorToScriptHash(
      exportScript(compileProtocolSvScript({ protocolNftMph }))
    ),
    projectVHash: lucid.utils.validatorToScriptHash(
      exportScript(compileProjectVScript({ projectAtMph, protocolNftMph }))
    ),
    projectDetailVHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileProjectDetailVScript({ projectAtMph, protocolNftMph })
      )
    ),
    projectScriptVHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileProjectScriptVScript({ projectAtMph, protocolNftMph })
      )
    ),
    backingVHash: lucid.utils.validatorToScriptHash(
      exportScript(compileBackingVScript({ proofOfBackingMph, protocolNftMph }))
    ),
    dedicatedTreasuryVHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileDedicatedTreasuryVScript({ projectAtMph, protocolNftMph })
      )
    ),
    sharedTreasuryVHash: lucid.utils.validatorToScriptHash(
      exportScript(
        compileSharedTreasuryVScript({
          projectAtMph,
          protocolNftMph,
          teikiMph,
        })
      )
    ),
    openTreasuryVHash: lucid.utils.validatorToScriptHash(
      exportScript(compileOpenTreasuryVScript({ protocolNftMph }))
    ),
  };
}

export function getMigratableScript(
  validatorHash: Hex,
  migrationInfo?: MigrationInfo
): MigratableScript {
  return constructMigratableScript(
    validatorHash,
    migrationInfo
      ? {
          [validatorHash]: {
            mintingPolicyHash: migrationInfo.migrateTokenMph,
            tokenName: migrationInfo.migrateTokenName,
          },
        }
      : {}
  );
}

export type MigrationInfo = {
  migrateTokenMph: Hex;
  migrateTokenName: Hex;
};
export type ProtocolRegistryParams = {
  protocolNftMph: Hex;
  teikiPlantNftMph: Hex;
  migrationInfo?: MigrationInfo;
};

export function getProtocolRegistry(
  lucid: Lucid,
  { protocolNftMph, teikiPlantNftMph, migrationInfo }: ProtocolRegistryParams
): Registry {
  const registryScript: RegistryScript = getProtocolRegistryScript(
    lucid,
    protocolNftMph,
    teikiPlantNftMph
  );

  return {
    protocolStakingValidator: {
      script: { hash: registryScript.protocolSvHash },
    },
    projectValidator: getMigratableScript(
      registryScript.projectVHash,
      migrationInfo
    ),
    projectDetailValidator: getMigratableScript(
      registryScript.projectDetailVHash,
      migrationInfo
    ),
    projectScriptValidator: getMigratableScript(
      registryScript.projectScriptVHash,
      migrationInfo
    ),
    backingValidator: getMigratableScript(
      registryScript.backingVHash,
      migrationInfo
    ),
    dedicatedTreasuryValidator: getMigratableScript(
      registryScript.dedicatedTreasuryVHash,
      migrationInfo
    ),
    sharedTreasuryValidator: getMigratableScript(
      registryScript.sharedTreasuryVHash,
      migrationInfo
    ),
    openTreasuryValidator: getMigratableScript(
      registryScript.openTreasuryVHash,
      migrationInfo
    ),
  };
}

// TODO: sk-saru should read from config file
export const SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS: ProtocolNonScriptParams = {
  // The Protocol Governor’s share of the protocol revenue (ADA & Teiki).
  // The ratio is represented by a [0..1] number multiplied by 1E+6.
  governorShareRatio: 800_000n, // For Alpha testing only. The final goal for Gen I is 88.89%.
  // The Protocol’s share (including Protocol Governor’s) share of the raised funds.
  // The ratio is represented by a [0..1] number multiplied by 1E+6.
  protocolFundsShareRatio: 45_000n, // 4.5%
  // The price per discount cent in Lovelace. Should be around 1E+4, to resemble a cent of an ADA. See Actors & Discounts.
  discountCentPrice: 10_000n,
  // Projects funding milestones in Lovelace.
  // Note that we can have a more compact format.
  projectMilestones: [
    1_000_000n, // For Alpha testing only. Will eventually remove.
    5_000_000_000n,
    15_000_000_000n,
    60_000_000_000n,
    300_000_000_000n,
    1_000_000_000_000n,
    2_500_000_000_000n,
  ],
  // The r protocol parameter in @Teiki Tokenomics.
  teikiCoefficient: 10n, // For Alpha testing only. Will eventually increase.
  // The burn rate of projects' Teiki per epoch.
  // The rate is represented by a [0..1] number multiplied by 1E+6.
  projectTeikiBurnRate: 50_000n, // 5% per epoch
  // The length of an epoch in milliseconds - Cardano Protocol Params.
  epochLength: { milliseconds: 432_000_000n }, // 5 days / epoch -- mainnet
  projectPledge: 500_000_000n,
  projectCreationFee: 10_000_000n,
  // Minimum project sponsorship fee ADA (in Lovelace). Higher number, higher position.
  projectSponsorshipMinFee: 500_000_000n,
  // If the Project Owner paid the sponsorship fee, the project would be sponsored for this duration (in milliseconds).
  projectSponsorshipDuration: { milliseconds: 2_592_000_000n }, // 30 days
  projectInformationUpdateFee: 1_000_000n,
  projectAnnouncementFee: 1_000_000n,
  // The minimum number of shared treasuries need to be created (to receive Teiki) per milestone-reached event.
  // Note that this is closely related to `projectMilestones`.
  minTreasuryPerMilestoneEvent: 1n, // For Alpha testing only. Will eventually increase.
  // The amount of ADA (in Lovelace) of a stake registration deposit - Cardano Protocol Params.
  stakeKeyDeposit: 2_000_000n,
  // Proposals have to go through a waiting period.
  proposalWaitingPeriod: { milliseconds: 20_000n }, // 1 block
  // Project delistings have to go through a waiting period. Initiated by Protocol Governor. Can be canceled during this period.
  projectDelistWaitingPeriod: { milliseconds: 20_000n }, // 1 block
};
