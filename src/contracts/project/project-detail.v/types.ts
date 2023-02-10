import { helios } from "../../program";

export default helios("v__project_detail__types")`
  module v__project_detail__types

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
    last_announcement_cid: Option[String]
  }
`;
