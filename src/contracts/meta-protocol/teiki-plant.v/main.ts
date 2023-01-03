import { Hex } from "@/types";

import { HeliosSource, helios } from "../../program";

export default function main(teikiPlantNftMph: Hex): HeliosSource {
  return helios`
    spending v__teiki_plant

    import {
      ADA_MINTING_POLICY_HASH,
      TEIKI_PLANT_NFT_TOKEN_NAME
    } from constants

    import {
      is_tx_authorized_by,
      does_tx_pass_token_preciate_check,
      does_tx_pass_minting_preciate_check
    } from helpers

    import {
      Datum,
      Redeemer,
      Authorization,
      TokenPredicate,
      MintingPredicate,
      MintingRedeemer,
      RulesProposal
    } from v__teiki_plant__types

    const TEIKI_PLANT_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${teikiPlantNftMph})
    const TEIKI_PLANT_NFT: Value =
      Value::new(
        AssetClass::new(
          TEIKI_PLANT_NFT_MPH,
          TEIKI_PLANT_NFT_TOKEN_NAME
        ),
        1
      )

    func does_authorization_pass(tx: Tx, authorization: Authorization) ->  Bool {
      authorization.switch {
        must_be: MustBe => {
          is_tx_authorized_by(tx, must_be.credential)
        },
        must_have: MustHave => {
          does_tx_pass_token_preciate_check(tx, must_have.predicate)
        },
        must_mint: MustMint => {
          does_tx_pass_minting_preciate_check(tx, must_mint.predicate)
        }
      }
    }

    func is_proposal_authorized(tx: Tx, proposal_authorizations: []Authorization) -> Bool {
      proposal_authorizations.all(
        (authorization: Authorization) -> Bool {
          does_authorization_pass(tx, authorization)
        }
      )
    }

    func is_teiki_plant_value_preserved(value: Value) -> Bool {
      value.to_map().all(
        (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> Bool {
          if (mph == ADA_MINTING_POLICY_HASH) { true }
          else if (mph == TEIKI_PLANT_NFT_MPH) { tokens == Map[ByteArray]Int {TEIKI_PLANT_NFT_TOKEN_NAME: 1} }
          else { false }
        }
      )
    }

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_input: TxInput = ctx.get_current_input();
      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      produced_output: TxOutput = tx.outputs_locked_by(own_validator_hash).head;
      produced_output_datum: Datum =
        produced_output.datum.switch{
          i: Inline => Datum::from_data(i.data),
          else => error("Invalid Teiki Plant UTxO: Missing inline datum")
        };

      proposal_authorizations: []Authorization = datum.rules.proposal_authorizations;
      assert(
        is_proposal_authorized(tx, proposal_authorizations),
        "The proposal must be authorized"
      );

      redeemer.switch {

        Propose => {
          output_proposal: RulesProposal = produced_output_datum.proposal.unwrap();

          assert(
            is_teiki_plant_value_preserved(produced_output.value),
            "Teiki Plant UTxO Value must be preserved"
          );

          assert(
            produced_output.address == own_input.output.address,
            "Teiki Plant UTxO Address must be preserved"
          );

          produced_output_datum.rules == datum.rules
           && output_proposal.in_effect_at
              > tx.time_range.end + datum.rules.proposal_waiting_period
        },

        Apply => {
          input_proposal: RulesProposal = datum.proposal.unwrap();

          assert(
            is_teiki_plant_value_preserved(produced_output.value),
            "Teiki Plant UTxO Value must be preserved"
          );

          assert(
            produced_output.address.credential == Credential::new_validator(own_validator_hash),
            "Teiki Plant UTxO Address Payment Credential must be preserved"
          );

          tx.time_range.start >= input_proposal.in_effect_at
           && produced_output_datum.rules == input_proposal.rules
           && produced_output_datum.proposal.switch {
                None => true,
                else => false
              }
        },

        Cancel => {
          assert(
            datum.proposal.switch {
              Some => true,
              else => false
            },
            "Input proposal must not be None"
          );

          assert(
            is_teiki_plant_value_preserved(produced_output.value),
            "Teiki Plant UTxO Value must be preserved"
          );

          assert(
            produced_output.address == own_input.output.address,
            "Teiki Plant UTxO Address must be preserved"
          );

          produced_output_datum.rules == datum.rules
           && produced_output_datum.proposal.switch {
                None => true,
                else => false
              }
        }

      }
    }
  `;
}
