import { Address, StakingValidatorHash, Time, TxOutputId } from "../helios";
import { Bool, Enum, Int, Option, Static, Struct, Void } from "../uplc";

import { IpfsCid, ProjectId } from "./common";

// ==================== V | Project ====================

export const ProjectStatus = Enum("type", {
  Active: Void,
  PreClosed: { pendingUntil: Time },
  PreDelisted: { pendingUntil: Time },
  Closed: { closedAt: Time },
  Delisted: { delistedAt: Time },
});
export type ProjectStatus = Static<typeof ProjectStatus>;

export const LegacyProjectStatus = Enum("type", {
  Active: Void,
  PreClosed: { pendingUntil: Time },
  PreDelisted: { pendingUntil: Time },
  Closed: Void,
  Delisted: Void,
});
export type LegacyProjectStatus = Static<typeof LegacyProjectStatus>;

export const ProjectDatum = Struct({
  projectId: ProjectId,
  ownerAddress: Address,
  status: ProjectStatus,
  milestoneReached: Int,
  isStakingDelegationManagedByProtocol: Bool,
});
export type ProjectDatum = Static<typeof ProjectDatum>;

export const LegacyProjectDatum = Struct({
  projectId: ProjectId,
  ownerAddress: Address,
  status: LegacyProjectStatus,
  milestoneReached: Int,
  isStakingDelegationManagedByProtocol: Bool,
});
export type LegacyProjectDatum = Static<typeof LegacyProjectDatum>;

export const ProjectRedeemer = Enum("case", {
  RecordNewMilestone: { newMilestone: Int },
  AllocateStakingValidator: { newStakingValidator: StakingValidatorHash },
  UpdateStakingDelegationManagement: Void,
  InitiateClose: Void,
  FinalizeClose: Void,
  InitiateDelist: Void,
  CancelDelist: Void,
  FinalizeDelist: Void,
  Migrate: Void,
});
export type ProjectRedeemer = Static<typeof ProjectRedeemer>;

// ==================== V | Project Detail ====================

export const Sponsorship = Struct({
  amount: Int,
  until: Time,
});
export type Sponsorship = Static<typeof Sponsorship>;

export const ProjectDetailDatum = Struct({
  projectId: ProjectId,
  withdrawnFunds: Int,
  sponsorship: Option(Sponsorship),
  informationCid: IpfsCid,
  lastAnnouncementCid: Option(IpfsCid),
});
export type ProjectDetailDatum = Static<typeof ProjectDetailDatum>;

export const LegacyProjectDetailDatum = Struct({
  projectId: ProjectId,
  withdrawnFunds: Int,
  sponsorshipUntil: Option(Time),
  informationCid: IpfsCid,
  lastAnnouncementCid: Option(IpfsCid),
});
export type LegacyProjectDetailDatum = Static<typeof LegacyProjectDetailDatum>;

export const ProjectDetailRedeemer = Enum("case", {
  WithdrawFunds: Void,
  Update: Void,
  Close: Void,
  Delist: Void,
  Migrate: Void,
});
export type ProjectDetailRedeemer = Static<typeof ProjectDetailRedeemer>;

// ==================== V | Project Script ====================

export const ProjectScriptDatum = Struct({
  projectId: ProjectId,
  stakingKeyDeposit: Int,
});
export type ProjectScriptDatum = Static<typeof ProjectScriptDatum>;

export const ProjectScriptRedeemer = Enum("case", {
  Close: Void,
  Delist: Void,
  Migrate: Void,
});
export type ProjectScriptRedeemer = Static<typeof ProjectScriptRedeemer>;

// ==================== AT | Project ====================

export const ProjectMintingRedeemer = Enum("case", {
  NewProject: { projectSeed: TxOutputId },
  AllocateStaking: Void,
  DeallocateStaking: Void,
  MigrateOut: Void,
  MigrateIn: Void,
});
export type ProjectMintingRedeemer = Static<typeof ProjectMintingRedeemer>;
