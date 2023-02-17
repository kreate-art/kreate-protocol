import { header, helios } from "../../program";

export default helios`
  ${header("module", "mp__proof_of_backing__types")}

  struct Plant {
    is_matured: Bool
    backing_output_id: TxOutputId
    backing_amount: Int
    unbacked_at: Time
    project_id: ByteArray
    backer_address: Address
    backed_at: Time
    milestone_backed: Int
  }

  enum Redeemer {
    Plant { cleanup: Bool }
    ClaimRewards { flowers: []Plant }
    MigrateOut
    MigrateIn
    Burn
  }
`;
