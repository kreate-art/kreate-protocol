import { helios } from "../../program";

export const hlProjectATTypesSource = helios`
  module project_at_types

  enum Redeemer {
    NewProject{ project_seed: TxOutputId}
    AllocateStaking
    DeallocateStaking
    Migrate
  }
`;
