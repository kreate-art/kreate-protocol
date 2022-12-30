import { helios } from "../../program";

export const hlProjectDetailTypesSource = helios`
  module project_detail_types

  enum Redeemer {
    WithdrawFunds
    Update
    Close
    Delist
    Migrate
  }

  struct Datum {
    project_id: ByteArray
    withdrawn_funds: Int
    sponsored_until: Option[Time]
    information_cid: String
    last_community_update_cid: Option[String]
  }
`;