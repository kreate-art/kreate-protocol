import { StakingValidatorHash, Time } from "../helios";
import { Bool, Enum, Int, Map, Static, Struct, Void } from "../uplc";

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
  WithdrawAda: Void,
  Revoke: Void,
  Migrate: Void,
});
export type DedicatedTreasuryRedeemer = Static<
  typeof DedicatedTreasuryRedeemer
>;

// ==================== V | Shared Treasury ====================

export const BurnAction = Enum("burn", {
  BurnPeriodically: Void,
  BurnEntirely: Void,
});
export type BurnAction = Static<typeof BurnAction>;

export const ProjectTeiki = Enum("teikiCondition", {
  TeikiEmpty: Void,
  TeikiBurntPeriodically: {
    available: Int,
    lastBurnAt: Time,
  },
  TeikiBurntEntirely: Void,
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
  Migrate: Void,
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
  WithdrawAda: Void,
  Migrate: Void,
});
export type OpenTreasuryRedeemer = Static<typeof OpenTreasuryRedeemer>;
