import { helios } from "../../program";

export const hlProjectScriptTypesSource = helios`
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
