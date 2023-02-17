import { header, helios } from "../../program";

export default helios`
  ${header("module", "v__backing__types")}

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
