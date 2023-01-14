import { helios } from "../../program";

export default helios("v__open_treasury__types", ["common__types"])`
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
