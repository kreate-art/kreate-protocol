import { StakingValidatorHash, TxOutputId } from "../helios";
import { Enum, Option, Static } from "../uplc";

import { ProjectId } from "./common";

export const UserTag = Enum("kind", {
  TagProjectFundsWithdrawal: { projectId: ProjectId },
  TagProjectClosed: { projectId: ProjectId },
  TagProjectScriptClosed: {
    projectId: ProjectId,
    stakingValidator: StakingValidatorHash,
  },
  TagInactiveBacking: { backingOutputId: TxOutputId },
  TagTreasuryWithdrawal: { treasuryOutputId: Option(TxOutputId) },
});
export type UserTag = Static<typeof UserTag>;

export const TreasuryTag = Enum("kind", {
  TagOriginated: { seed: TxOutputId },
  TagContinuation: { former: TxOutputId },
  TagProtocolStakingRewards: { stakingValidator: StakingValidatorHash },
  TagProjectDelayedStakingRewards: { stakingValidator: Option(TxOutputId) },
  TagProjectDelisted: { projectId: ProjectId },
  TagProjectScriptDelisted: {
    projectId: ProjectId,
    stakingValidator: StakingValidatorHash,
  },
});
export type TreasuryTag = Static<typeof TreasuryTag>;
