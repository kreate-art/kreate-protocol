import { helios } from "../../program";

export const hlProjectScriptTypesSource = helios`
  module project_script_types

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
