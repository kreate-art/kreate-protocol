import { header, helios } from "../../program";

export default helios`
  ${header("module", "v__project_script__types")}

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
