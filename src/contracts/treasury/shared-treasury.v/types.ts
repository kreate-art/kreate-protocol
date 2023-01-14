import { helios } from "../../program";

export default helios("v__shared_treasury__types", ["common__types"])`
  module v__shared_treasury__types

  import { TreasuryTag } from common__types

  enum ProjectTeiki {
    TeikiEmpty
    TeikiBurntPeriodically {
      available: Int
      last_burn_at: Time
    }
    TeikiBurntEntirely
  }

  struct Datum {
    project_id: ByteArray
    governor_teiki: Int
    project_teiki: ProjectTeiki
    tag: TreasuryTag
  }

  enum BurnAction {
    BurnPeriodically
    BurnEntirely
  }

  struct BurnActionResult {
    new_project_teiki: ProjectTeiki
    project_rewards: Int
  }

  enum Redeemer {
    UpdateTeiki {
      burn_action: BurnAction
      burn_amount: Int
      rewards: Int
    }
    Migrate
  }
`;
