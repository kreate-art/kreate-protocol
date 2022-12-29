import { helios } from "../../program";

export const hlOpenTreasuryTypesSource = helios`
  module open_treasury_types

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
