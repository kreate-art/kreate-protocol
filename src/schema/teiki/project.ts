import { Address, StakingValidatorHash, Time, TxOutputId } from "../helios";
import { Bool, Enum, Int, Option, Static, Struct, Void } from "../uplc";

import { IpfsCid, ProjectId } from "./common";

// ==================== V | Project ====================

export const ProjectStatus = Enum("type", {
  Active: Void,
  PreClosed: { pendingUntil: Time },
  PreDelisted: { pendingUntil: Time },
  Closed: Void,
  Delisted: Void,
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
  UpdateStakingDelegationManagement: Void,
  InitiateClose: Void,
  InitiateDelist: Void,
  CancelDelist: Void,
  FinalizeClose: Void,
  Migrate: Void,
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
});
export type ProjectMintingRedeemer = Static<typeof ProjectMintingRedeemer>;
