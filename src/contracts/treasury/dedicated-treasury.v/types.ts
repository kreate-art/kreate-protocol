import { helios } from "../../program";

export default helios("v__dedicated_treasury__types", ["common__types"])`
  module v__dedicated_treasury__types

  import { TreasuryTag } from common__types

  struct Datum {
    project_id: ByteArray
    governor_ada: Int
    tag: TreasuryTag
  }

  enum Redeemer {
    CollectFees {
      min_fees: Int
      split: Bool
    }
    WithdrawAda
    Revoke
    Migrate
  }
`;
