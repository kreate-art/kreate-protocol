import { helios } from "../../program";

export const hlBackingValidatorTypesSource = helios`
  module backing_validator_types

  struct Datum {
    project_id: ByteArray
    backer_address: Address
    staked_at: Time
    milestone_backed: Int
  }

  enum Redeemer {
    Unstake
    Migrate
  }
`;
