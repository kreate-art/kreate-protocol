import { Address, StakingValidatorHash, Time, TxOutputId } from "../helios";
import { Bool, Enum, Int, Option, Static, Struct } from "../uplc";

import { IpfsCid, ProjectId } from "./common";

// ==================== V | Project ====================

export const ProjectStatus = Enum("status", {
  Active: {},
  PreClosed: { pendingUntil: Time },
  PreDelisted: { pendingUntil: Time },
  Closed: {},
  Delisted: {},
});
export type ProjectStatus = Static<typeof ProjectStatus>;

export const ProjectDatum = Struct({
  projectId: ProjectId,
  ownerAddress: Address,
  status: ProjectStatus,
  milestoneReached: Int,
  isStakingDelegationManagedByProtocol: Bool,
});
export type ProjectDatum = Static<typeof ProjectDatum>;

export const ProjectRedeemer = Enum("case", {
  RecordNewMilestone: { newMilestone: Int },
  AllocateStakingValidator: { newStakingValidator: StakingValidatorHash },
  UpdateStakingDelegationManagement: {},
  InitiateClose: {},
  InitiateDelist: {},
  CancelDelist: {},
  FinalizeClose: {},
  Migrate: {},
});
export type ProjectRedeemer = Static<typeof ProjectRedeemer>;

// ==================== V | Project Detail ====================

export const ProjectDetailDatum = Struct({
  projectId: ProjectId,
  withdrawnFunds: Int,
  sponsoredUntil: Option(Time),
  informationCid: IpfsCid,
  lastCommunityUpdateCid: Option(IpfsCid),
});
export type ProjectDetailDatum = Static<typeof ProjectDetailDatum>;

export const ProjectDetailRedeemer = Enum("case", {
  WithdrawFunds: {},
  Update: {},
  Close: {},
  Delist: {},
  Migrate: {},
});
export type ProjectDetailRedeemer = Static<typeof ProjectDetailRedeemer>;

// ==================== V | Project Script ====================

export const ProjectScriptDatum = Struct({
  projectId: ProjectId,
  stakingKeyDeposit: Int,
});
export type ProjectScriptDatum = Static<typeof ProjectScriptDatum>;

export const ProjectScriptRedeemer = Enum("case", {
  Close: {},
  Delist: {},
  Migrate: {},
});
export type ProjectScriptRedeemer = Static<typeof ProjectScriptRedeemer>;

// ==================== AT | Project ====================

export const ProjectMintingRedeemer = Enum("case", {
  NewProject: { projectSeed: TxOutputId },
  AllocateStaking: {},
  DeallocateStaking: {},
});
export type ProjectMintingRedeemer = Static<typeof ProjectMintingRedeemer>;
