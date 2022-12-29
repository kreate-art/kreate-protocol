import { helios } from "../../program";

export const hlPProposalTypesSource = helios`
  module protocol_proposal_types

  import { Datum as PParamsDatum } from protocol_params_types

  struct Proposal {
    in_effect_at: Time
    base: TxOutputId
    params: PParamsDatum
  }

  struct Datum {
    inner: Option[Proposal]
  }

  enum Redeemer {
    Propose
    Apply
    Cancel
  }
`;
