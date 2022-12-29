import { helios } from "../program";

export default helios`
  module common__types

  enum UserTag {
    TagProjectFundsWithdrawal { project_id: ByteArray }
    TagProjectClosed { project_id: ByteArray }
    TagProjectScriptClosed {
      project_id: ByteArray
      staking_validator: StakingValidatorHash
    }
    TagInactiveBacking { backing_output_id: TxOutputId }
    TagTreasuryWithdrawal { treasury_output_id: Option[TxOutputId] }
  }

  enum TreasuryTag {
    TagOriginated { seed: TxOutputId }
    TagContinuation { former: TxOutputId }
    TagProtocolStakingRewards { staking_validator: StakingValidatorHash }
    TagProjectDelayedStakingRewards { staking_validator: Option[StakingValidatorHash] }
    TagProjectDelisted { project_id: ByteArray }
    TagProjectScriptDelisted {
      project_id: ByteArray
      staking_validator: StakingValidatorHash
    }
  }

`;
