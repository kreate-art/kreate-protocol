import { helios } from "../../program";

export default helios("at__project__types")`
  module at__project__types

  enum Redeemer {
    NewProject{ project_seed: TxOutputId}
    AllocateStaking
    DeallocateStaking
    Migrate
  }
`;
