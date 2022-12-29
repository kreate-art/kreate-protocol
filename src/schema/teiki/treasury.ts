import { StakingValidatorHash, Time } from "../helios";
import { Bool, Enum, Int, Map, Static, Struct } from "../uplc";

import { ProjectId } from "./common";
import { TreasuryTag } from "./tags";

// ==================== V | Dedicated Treasury ====================

export const DedicatedTreasuryDatum = Struct({
  projectId: ProjectId,
  governorAda: Int,
  tag: TreasuryTag,
});
export type DedicatedTreasuryDatum = Static<typeof DedicatedTreasuryDatum>;

export const DedicatedTreasuryRedeemer = Enum("case", {
  CollectFees: { minFees: Int, split: Bool },
  WithdrawAda: {},
  Revoke: {},
  Migrate: {},
});
export type DedicatedTreasuryRedeemer = Static<
  typeof DedicatedTreasuryRedeemer
>;

// ==================== V | Shared Treasury ====================

export const BurnAction = Enum("burn", {
  BurnPeriodically: {},
  BurnEntirely: {},
});
export type BurnAction = Static<typeof BurnAction>;

export const ProjectTeiki = Enum("teikiCondition", {
  TeikiEmpty: {},
  TeikiBurntPeriodically: {
    available: Int,
    lastBurnAt: Time,
  },
  TeikiBurntEntirely: {},
});
export type ProjectTeiki = Static<typeof ProjectTeiki>;

export const SharedTreasuryDatum = Struct({
  projectId: ProjectId,
  governorTeiki: Int,
  projectTeiki: ProjectTeiki,
  tag: TreasuryTag,
});
export type SharedTreasuryDatum = Static<typeof SharedTreasuryDatum>;

export const SharedTreasuryRedeemer = Enum("case", {
  UpdateTeiki: {
    burnAction: BurnAction,
    burnAmount: Int,
    rewards: Int,
  },
  Migrate: {},
});
export type SharedTreasuryRedeemer = Static<typeof SharedTreasuryRedeemer>;

// ==================== V | Open Treasury ====================

export const OpenTreasuryDatum = Struct({
  governorAda: Int,
  tag: TreasuryTag,
});
export type OpenTreasuryDatum = Static<typeof OpenTreasuryDatum>;

export const OpenTreasuryRedeemer = Enum("case", {
  CollectDelayedStakingRewards: {
    stakingWithdrawals: Map(StakingValidatorHash, Int),
  },
  WithdrawAda: {},
  Migrate: {},
});
export type OpenTreasuryRedeemer = Static<typeof OpenTreasuryRedeemer>;
