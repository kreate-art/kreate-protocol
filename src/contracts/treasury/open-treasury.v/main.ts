import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  protocolNftMph: Hex;
};

export default function main({ protocolNftMph }: Params) {
  return helios`
    ${header("spending", "v__open_treasury")}

    import { Datum, Redeemer }
      from ${module("v__open_treasury__types")}
    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}
    import { UserTag }
      from ${module("common__types")}

    import {
      find_pparams_datum_from_inputs,
      min, max,
      is_tx_authorized_by,
      scriptHashToStakingCredential
    } from ${module("helpers")}

    import {
      RATIO_MULTIPLIER,
      TREASURY_MIN_WITHDRAWAL_ADA,
      TREASURY_WITHDRAWAL_DISCOUNT_RATIO
    } from ${module("constants")}

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_input_txinput: TxInput = ctx.get_current_input();

      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      redeemer.switch {
        collecting: CollectDelayedStakingRewards => {
          total_withdrawals: Int =
            collecting.staking_withdrawals
              .fold(
                (acc: Int, _, withdrawal: Int) -> Int {
                  acc + withdrawal
                },
                0
              );

          own_output_txouts: []TxOutput = tx.outputs_locked_by(ctx.get_current_validator_hash());

          own_output_txout: TxOutput = own_output_txouts.head;

          own_output_datum: Datum =
            own_output_txout.datum.switch{
              i: Inline => Datum::from_data(i.data),
              else => error("Invalid open treasury UTxO: Missing inline datum")
            };

          own_input_txinput.output.address == Address::new(
            Credential::new_validator(
              pparams_datum.registry.open_treasury_validator.latest
            ),
            Option[StakingCredential]::Some{
              scriptHashToStakingCredential(
                pparams_datum.registry.protocol_staking_validator
              )
            }
          )
            && own_output_txouts.length == 1
            && own_output_txout.value == Value::lovelace(
              own_input_txinput.output.value.get_safe(AssetClass::ADA) + total_withdrawals
            )
            && own_output_datum.governor_ada
                == datum.governor_ada + total_withdrawals * pparams_datum.governor_share_ratio / RATIO_MULTIPLIER
            && own_output_datum.tag.switch {
              tag: TagProjectDelayedStakingRewards =>
                tag.staking_validator.switch {
                  None => true,
                  else => false
                }
              ,
              else => false
            }
            && own_validator_hash
                == pparams_datum.registry.open_treasury_validator.latest
        },
        WithdrawAda => {
          treasury_txinputs: []TxInput =
            tx.inputs
              .filter (
                (input: TxInput) -> Bool {
                  input.output.address.credential == Credential::new_validator(own_validator_hash)
                }
              );

          is_not_min_txinput: Bool =
            treasury_txinputs.any(
              (input: TxInput) -> Bool {
                input.output_id < own_input_txinput.output_id
              }
            );

          if (is_not_min_txinput) {
            true
          } else {
            in_w: Int =
              treasury_txinputs.fold(
                (acc: Int, input: TxInput) -> Int {
                  acc + input.output.value.get_safe(AssetClass::ADA)
                },
                0
              );

            in_g: Int =
              treasury_txinputs.fold(
                (acc: Int, input: TxInput) -> Int {
                  treasury_datum: Datum = input.output.datum.switch {
                    i: Inline => Datum::from_data(i.data),
                    else => error("Invalid treasury UTxO: missing inline datum")
                  };

                  acc + min(max(0, treasury_datum.governor_ada), input.output.value.get_safe(AssetClass::ADA))
                },
                0
              );

            own_output_txout: TxOutput =
              tx.outputs_locked_by(ctx.get_current_validator_hash())
                .head;

            own_output_datum: Datum =
              own_output_txout.datum.switch{
                i: Inline => Datum::from_data(i.data),
                else => error("Invalid open treasury UTxO: Missing inline datum")
              };

            out_w: Int = own_output_txout.value.get_safe(AssetClass::ADA);

            delta: Int = in_w - out_w;

            own_validator_hash
              == pparams_datum.registry.open_treasury_validator.latest
              && own_output_datum.governor_ada == 0
              && own_output_datum.tag.switch {
                tag: TagContinuation => {
                  tag.former == own_input_txinput.output_id
                },
                else => false
              }
              && delta == in_g
              && if(!is_tx_authorized_by(tx, pparams_datum.governor_address.credential)){
                delta >= TREASURY_MIN_WITHDRAWAL_ADA
                  && tx.outputs.any(
                    (output: TxOutput) -> Bool {
                      output.address == pparams_datum.governor_address
                        && output.value == Value::lovelace(delta * (RATIO_MULTIPLIER - TREASURY_WITHDRAWAL_DISCOUNT_RATIO) / RATIO_MULTIPLIER)
                        && output.datum.switch {
                          i: Inline =>
                            UserTag::from_data(i.data).switch {
                              tag: TagTreasuryWithdrawal =>
                                tag.treasury_output_id.unwrap() == own_input_txinput.output_id,
                                else => false
                            }
                          ,
                          else => false
                        }
                    }
                  )
              } else {
                delta > 0
              }
          }
        },
        Migrate => {
          migration_asset_class: AssetClass =
            pparams_datum
              .registry
              .open_treasury_validator
              .migrations
              .get(own_validator_hash);

          tx.minted.get_safe(migration_asset_class) != 0
        }
      }
    }
  `;
}
