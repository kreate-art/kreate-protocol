import { helios } from "../../program";

export default helios`
  module v__backing__types

  struct Datum {
    project_id: ByteArray
    backer_address: Address
    staked_at: Time
    milestone_backed: Int
  }

  enum Redeemer {
    Unstake
    Migrate
  }
`;
