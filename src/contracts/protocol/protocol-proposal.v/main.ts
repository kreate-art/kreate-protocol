import { Hex } from "@/types";

import { header, helios, HeliosScript, module } from "../../program";

export type Params = {
  protocolNftMph: Hex;
};

export default function main({ protocolNftMph }: Params): HeliosScript {
  return helios`
    ${header("spending", "v__protocol_proposal")}

    import {
      ADA_MINTING_POLICY_HASH,
      PROTOCOL_PARAMS_NFT_TOKEN_NAME,
      PROTOCOL_PROPOSAL_NFT_TOKEN_NAME
    } from ${module("constants")}

    import { is_tx_authorized_by }
      from ${module("helpers")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import { Datum, Redeemer, Proposal }
      from ${module("v__protocol_proposal__types")}

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const PROTOCOL_PARAMS_NFT: AssetClass =
      AssetClass::new(PROTOCOL_NFT_MPH, PROTOCOL_PARAMS_NFT_TOKEN_NAME)

    func are_output_value_and_address_valid(
      output: TxOutput,
      address: Address,
      token_name: ByteArray
    ) -> Bool {
      output.value.to_map().all(
        (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> {
          if (mph == PROTOCOL_NFT_MPH) {
            tokens == Map[ByteArray]Int {token_name: 1}
          } else {
            mph == ADA_MINTING_POLICY_HASH
          }
        }
      )
        && output.address == address
    }

    func is_proposal_empty(datum: Datum) -> Bool {
      datum.proposal.switch {
        None => true,
        else => false
      }
    }

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      own_input_txout: TxOutput = ctx.get_current_input().output;

      own_output_txout: TxOutput =
        tx.outputs_locked_by(ctx.get_current_validator_hash())
          .head;

      own_output_datum: Datum =
        own_output_txout.datum.switch {
          i: Inline => Datum::from_data(i.data),
          else => error("Invalid proposal UTxO: missing inline datum")
        };

      pparams_input: TxInput =
        (tx.inputs + tx.ref_inputs)
          .find(
            (input: TxInput) -> { input.output.value.get_safe(PROTOCOL_PARAMS_NFT) == 1 }
          );

      pparams_datum: PParamsDatum =
        pparams_input.output.datum.switch {
          i: Inline => PParamsDatum::from_data(i.data),
          else => error("Invalid protocol params UTxO: missing inline datum")
        };

      assert(
        is_tx_authorized_by(tx, pparams_datum.governor_address.credential),
        "The proposal must be authorized"
      );

      assert(
        are_output_value_and_address_valid(
          own_output_txout,
          own_input_txout.address,
          PROTOCOL_PROPOSAL_NFT_TOKEN_NAME
        ),
        "Invalid proposal output value and address"
      );

      redeemer.switch {

        Propose => {
          new_proposal: Proposal = own_output_datum.proposal.unwrap();

          new_proposal.in_effect_at >= tx.time_range.end + pparams_datum.proposal_waiting_period
            && new_proposal.base == pparams_input.output_id
        },

        Apply => {
          proposal: Proposal = datum.proposal.unwrap();

          new_pparams_output: TxOutput =
            tx.outputs
              .find((output: TxOutput) -> { output.value.get_safe(PROTOCOL_PARAMS_NFT) == 1 });

          new_pparams_datum: PParamsDatum =
            new_pparams_output.datum.switch {
              i: Inline => PParamsDatum::from_data(i.data),
              else => error("Invalid protocol params UTxO: missing inline datum")
            };

          are_output_value_and_address_valid(
            new_pparams_output,
            pparams_input.output.address,
            PROTOCOL_PARAMS_NFT_TOKEN_NAME
          )
            && tx.time_range.start >= proposal.in_effect_at
            && proposal.base == pparams_input.output_id
            && proposal.params == new_pparams_datum
            && is_proposal_empty(own_output_datum)
        },

        Cancel => {
          is_proposal_empty(own_output_datum) && !is_proposal_empty(datum)
        }

      }
    }
  `;
}
