import { helios } from "../../program";

export const hlPProposalTypesSource = helios`
  module v__protocol_proposal__types

  import { Datum as PParamsDatum } from v__protocol_params__types

  struct Proposal {
    in_effect_at: Time
    base: TxOutputId
    params: PParamsDatum
  }

  struct Datum {
    proposal: Option[Proposal]
  }

  enum Redeemer {
    Propose
    Apply
    Cancel
  }
`;
