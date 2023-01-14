import { helios } from "../../program";

export default helios("v__protocol_params__types")`
  module v__protocol_params__types

  enum Redeemer {
    ApplyProposal
  }

  struct MigratableScript {
    latest: ValidatorHash
    migrations: Map[ValidatorHash]AssetClass
  }

  struct Registry {
    protocol_staking_validator: ScriptHash
    project_validator: MigratableScript
    project_detail_validator: MigratableScript
    project_script_validator: MigratableScript
    backing_validator: MigratableScript
    dedicated_treasury_validator: MigratableScript
    shared_treasury_validator: MigratableScript
    open_treasury_validator: MigratableScript
  }

  struct Datum {
    registry: Registry
    governor_address: Address
    governor_share_ratio: Int
    protocol_funds_share_ratio: Int
    discount_cent_price: Int
    project_milestones: []Int
    teiki_coefficient: Int
    project_teiki_burn_rate: Int
    epoch_length: Duration
    project_pledge: Int
    project_creation_fee: Int
    project_sponsorship_fee: Int
    project_sponsorship_duration: Duration
    project_information_update_fee: Int
    project_community_update_fee: Int
    min_treasury_per_milestone_event: Int
    stake_key_deposit: Int
    proposal_waiting_period: Duration
    project_delist_waiting_period: Duration
  }
`;
