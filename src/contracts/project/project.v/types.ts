import { helios } from "../../program";

export default helios("v__project__types")`
  module v__project__types

  enum ProjectStatus {
    Active
    PreClosed { pending_until: Time }
    PreDelisted { pending_until: Time }
    Closed { closed_at: Time }
    Delisted { delisted_at: Time }
  }

  struct Datum {
    project_id: ByteArray
    owner_address: Address
    status: ProjectStatus
    milestone_reached: Int
    is_staking_delegation_managed_by_protocol: Bool
  }

  enum Redeemer {
    RecordNewMilestone { new_milestone: Int }
    AllocateStakingValidator { new_staking_validator: StakingValidatorHash }
    UpdateStakingDelegationManagement
    InitiateClose
    FinalizeClose
    InitiateDelist
    CancelDelist
    FinalizeDelist
    Migrate
  }
`;
