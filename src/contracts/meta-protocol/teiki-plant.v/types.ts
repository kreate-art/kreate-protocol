import { helios } from "../../program";

export default helios`
  module v__teiki_plant__types

  enum MintingAmount {
    Zero
    NonZero
    Positive
    Negative
  }

  enum MintingRedeemer {
    Any
    ConstrIn { constrs: []Int }
    ConstrNotIn { constrs: []Int }
  }

  struct MintingPredicate {
    minting_policy_hash: MintingPolicyHash
    redeemer: MintingRedeemer
    amounts: Option[Map[ByteArray]MintingAmount]
  }

  struct TokenPredicate {
    minting_policy_hash: MintingPolicyHash
    token_names: Option[[]ByteArray]
  }

  enum Authorization {
    MustBe { credential: Credential }
    MustHave { predicate: TokenPredicate }
    MustMint { predicate: MintingPredicate }
  }

  struct Rules {
    teiki_minting_rules: []MintingPredicate
    proposal_authorizations: []Authorization
    proposal_waiting_period: Duration
  }

  struct RulesProposal {
    in_effect_at: Time
    rules: Rules
  }

  struct Datum {
    rules: Rules
    proposal: Option[RulesProposal]
  }

  enum Redeemer {
    Propose
    Apply
    Cancel
  }
`;
