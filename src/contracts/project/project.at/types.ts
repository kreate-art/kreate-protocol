import { helios } from "../../program";

export const hlProjectATTypesSource = helios`
  module at__project__types

  enum Redeemer {
    NewProject{ project_seed: TxOutputId}
    AllocateStaking
    DeallocateStaking
    Migrate
  }
`;
