import { helios, HeliosSource } from "../../program";

export default function main(protocolNftMph: string): HeliosSource {
  return helios`
    spending v__protocol_proposal

    import { Datum as PParamsDatum } from v__protocol_params__types
    import { Datum, Redeemer, Proposal } from v__protocol_proposal__types

    import {
      find_tx_input_with_value,
      get_pparams_datum,
      is_tx_authorized_by
    } from helpers

    import { PROTOCOL_PARAMS_NFT_TOKEN_NAME } from constants

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const PROTOCOL_PARAMS_NFT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROTOCOL_NFT_MPH, PROTOCOL_PARAMS_NFT_TOKEN_NAME)

    const PROTOCOL_PARAMS_NFT: Value =
      Value::new(PROTOCOL_PARAMS_NFT_ASSET_CLASS, 1)


    func are_proposal_output_value_and_address_valid(input_txout: TxOutput, output_txout: TxOutput) -> Bool {
      output_txout.address == input_txout.address
        && output_txout.value >= input_txout.value
        && output_txout.value.to_map().length == 2 // ADA and the NFT
    }

    func is_datum_none(datum: Datum) -> Bool {
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
        own_output_txout.datum
          .switch {
            i:Inline => Datum::from_data(i.data),
            else => error("Invalid proposal UTxO: missing inline datum")
          };

      pparams_txinput: TxInput =
        find_tx_input_with_value(
          tx.inputs + tx.ref_inputs,
          PROTOCOL_PARAMS_NFT
        );

      pparams_datum: PParamsDatum = get_pparams_datum(pparams_txinput.output);

      is_tx_authorized_by(tx, pparams_datum.governor_address.credential)
        && are_proposal_output_value_and_address_valid(own_input_txout, own_output_txout)
        && redeemer.switch {
            Propose => {
              output_proposal: Proposal = own_output_datum.proposal.unwrap();

              output_proposal.in_effect_at > tx.time_range.end + pparams_datum.proposal_waiting_period
                && output_proposal.base == pparams_txinput.output_id

            },
            Apply => {
              proposal: Proposal = datum.proposal.unwrap();

              output_pparams_txout: TxOutput =
                tx.outputs.find(
                  (output: TxOutput) -> Bool { output.value.contains(PROTOCOL_PARAMS_NFT) }
                );

              output_pparams_datum: PParamsDatum =
                get_pparams_datum(output_pparams_txout);

              tx.time_range.start > proposal.in_effect_at
                && proposal.base == pparams_txinput.output_id
                && are_proposal_output_value_and_address_valid(pparams_txinput.output, output_pparams_txout)
                && proposal.params == output_pparams_datum
                && is_datum_none(own_output_datum)
            },
            Cancel => {
              (!is_datum_none(datum))
                && is_datum_none(own_output_datum)
            },
            else => false
          }
    }
  `;
}
