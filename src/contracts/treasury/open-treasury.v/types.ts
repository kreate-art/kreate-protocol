import { header, helios, module } from "../../program";

export default helios`
  ${header("module", "v__open_treasury__types")}

  import { TreasuryTag }
    from ${module("common__types")}

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
