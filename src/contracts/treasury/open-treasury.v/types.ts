import { helios } from "../../program";

export const hlOpenTreasuryTypesSource = helios`
  module v__open_treasury__types

  import { TreasuryTag } from common__types

  struct Datum {
    governor_ada: Int
    tag: TreasuryTag
  }

  enum Redeemer {
    CollectDelayedStakingRewards { staking_withdrawals: Map[StakingValidatorHash]Int}
    WithdrawAda
    Migrate
  }
`;
