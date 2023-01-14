import { helios } from "../../program";

export default helios("v__project_script__types")`
  module v__project_script__types

  struct Datum {
    project_id: ByteArray
    stake_key_deposit: Int
  }

  enum Redeemer {
    Close
    Delist
    Migrate
  }
`;
