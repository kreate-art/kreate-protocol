import { header, helios } from "../../program";

export default helios`
  ${header("module", "at__project__types")}

  enum Redeemer {
    NewProject { project_seed: TxOutputId }
    AllocateStaking
    DeallocateStaking
    MigrateOut
    MigrateIn
  }
`;
