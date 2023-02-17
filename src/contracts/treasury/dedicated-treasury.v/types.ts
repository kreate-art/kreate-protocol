import { header, helios, module } from "../../program";

export default helios`
  ${header("module", "v__dedicated_treasury__types")}

  import { TreasuryTag }
    from ${module("common__types")}

  struct Datum {
    project_id: ByteArray
    governor_ada: Int
    tag: TreasuryTag
  }

  enum Redeemer {
    CollectFees {
      fees: Int
      split: Bool
    }
    WithdrawAda
    Revoke
    Migrate
  }
`;
