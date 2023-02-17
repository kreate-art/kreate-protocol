import { header, helios, module } from "../../program";

export default helios`
  ${header("module", "v__protocol_proposal__types")}

  import { Datum as PParamsDatum }
    from ${module("v__protocol_params__types")}

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
