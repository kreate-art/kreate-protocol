import { helios } from "../../program";

export default helios("v__backing__types")`
  module v__backing__types

  struct Datum {
    project_id: ByteArray
    backer_address: Address
    backed_at: Time
    milestone_backed: Int
  }

  enum Redeemer {
    Unback
    Migrate
  }
`;
