import { helios } from "../../program";

export default helios`
  module proof_of_backing_types

  struct Plant {
    is_matured: Bool
    backing_output_id: TxOutputId
    backing_amount: Int
    unstaked_at: Time
    project_id: ByteArray
    backer_address: Address
    staked_at: Time
    milestone_backed: Int
  }

  enum Redeemer {
    Plant { cleanup: Bool }
    ClaimRewards { flowers: []Plant}
    Migrate
  }

  func to_fruit(flower: Plant) -> Plant {
    Plant {
      is_matured: true,
      backing_output_id: flower.backing_output_id,
      backing_amount: flower.backing_amount,
      unstaked_at: flower.unstaked_at,
      project_id: flower.project_id,
      backer_address: flower.backer_address,
      staked_at: flower.staked_at,
      milestone_backed: flower.milestone_backed
    }
  }

  struct PlantAccumulator {
    plant_map: Map[ByteArray]Int
    total_teiki_rewards: Int
    wilted_amount: Int
  }
`;
