import { helios } from "../../program";

export type DedicatedTreasuryParams = {
  projectsAuthTokenMph: string;
  protocolNftMph: string;
};

export default function main({
  projectsAuthTokenMph,
  protocolNftMph,
}: DedicatedTreasuryParams) {
  return helios`
    spending v__dedicated_treasury

    import { Datum, Redeemer } from v__dedicated_treasury__types
    import { Datum as PParamsDatum } from v__protocol_params__types
    import {
      Datum as ProjectDetailDatum,
      Redeemer as ProjectDetailRedeemer
    } from v__project_detail__types
    import {
      Datum as ProjectDatum
    } from v__project__types
    import { Datum as SharedTreasuryDatum } from v__shared_treasury__types
    import { UserTag } from common__types
    import { Datum as OpenTreasuryDatum } from v__open_treasury__types

    import {
      find_pparams_datum_from_inputs,
      scriptHashToStakingCredential,
      is_tx_authorized_by,
      min, max
    } from helpers

    import {
      MULTIPLIER,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_DETAIL_AT_TOKEN_NAME,
      TREASURY_UTXO_MIN_ADA,
      TREASURY_MIN_WITHDRAWAL_ADA,
      TREASURY_REVOKE_DISCOUNT_CENTS,
      TREASURY_WITHDRAWAL_DISCOUNT_RATIO
    } from constants

    const PROJECTS_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectsAuthTokenMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_DETAIL_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_DETAIL_AT_TOKEN_NAME)

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(datum: Datum, redeemer: Redeemer, ctx:ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_input_txinput: TxInput = ctx.get_current_input();

      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      redeemer.switch {
        collect_fees: CollectFees => {
          project_detail_txinput: TxInput =
            tx.inputs.find(
              (input: TxInput) -> Bool {
                input.output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                  && input.output.datum
                      .switch {
                        i: Inline => ProjectDetailDatum::from_data(i.data).project_id == datum.project_id,
                        else => false
                      }
              }
            );

          script_purpose: ScriptPurpose = ScriptPurpose::new_spending(project_detail_txinput.output_id);

          project_detail_redeemer_data: Data = tx.redeemers.get(script_purpose);

          own_output_txout: TxOutput =
            tx.outputs_locked_by(ctx.get_current_validator_hash())
              .head;

          own_output_datum: Datum =
            own_output_txout.datum.switch{
              i: Inline => Datum::from_data(i.data),
              else => error("Invalid dedicated treasury UTxO: Missing inline datum")
            };

          is_output_datum_valid: Bool =
            own_output_datum.project_id == datum.project_id
              && own_output_datum.tag.switch {
                tag: TagContinuation =>
                  tag.former == own_input_txinput.output_id,
                else => false
              };

          N: Int =
            if (!collect_fees.split) { 0 }
            else {
              shared_treasury_txouts: []TxOutput =
                tx.outputs
                  .filter(
                    (output: TxOutput) -> Bool {
                      output.address == Address::new(
                        Credential::new_validator(
                          pparams_datum.registry
                            .shared_treasury_validator
                            .latest
                        ),
                        Option[StakingCredential]::Some{
                          scriptHashToStakingCredential(
                            pparams_datum.registry.protocol_staking_validator
                          )
                        }
                      )
                        && output.value == Value::lovelace(TREASURY_UTXO_MIN_ADA)
                        && output.datum.switch {
                          i: Inline => {
                            shared_treasury_datum:SharedTreasuryDatum = SharedTreasuryDatum::from_data(i.data);

                            shared_treasury_datum.project_id == datum.project_id
                              && shared_treasury_datum.project_teiki.switch {
                                TeikiEmpty => true,
                                else => false
                              }
                              && shared_treasury_datum.governor_teiki == 0
                              && shared_treasury_datum.tag.switch {
                                tag: TagContinuation =>
                                  tag.former == own_input_txinput.output_id,
                                else => false
                              }
                          },
                          else => false
                        }
                    }
                  );

              if (shared_treasury_txouts.length >= pparams_datum.min_treasury_per_milestone_event) {
                shared_treasury_txouts.length
              } else {
                0
              }
            };

          in_w: Int = own_input_txinput.output.value.get_safe(AssetClass::ADA);
          in_g: Int = min(max(0, datum.governor_ada), in_w);
          out_w: Int = own_output_txout.value.get_safe(AssetClass::ADA);
          out_g: Int = own_output_datum.governor_ada;
          split: Int = N * TREASURY_UTXO_MIN_ADA;
          fee: Int = out_w + split - in_w;
          fee_g: Int = out_g - in_g;

          are_statments_valid: Bool =
            0 <= out_g && out_g <= out_w
              && fee >= collect_fees.min_fees
              && fee_g == fee * pparams_datum.governor_share_ratio / MULTIPLIER;

          own_validator_hash
            == pparams_datum.registry.dedicated_treasury_validator.latest
            && (collect_fees.min_fees > 0 || collect_fees.split)
            && ProjectDetailRedeemer::from_data(project_detail_redeemer_data).switch {
              WithdrawFunds => true,
              Update => true,
              else => false
            }
            && is_output_datum_valid
            && are_statments_valid
        },
        WithdrawAda => {
          own_output_txout: TxOutput =
            tx.outputs_locked_by(ctx.get_current_validator_hash())
              .head;

          own_output_datum: Datum =
            own_output_txout.datum.switch{
              i: Inline => Datum::from_data(i.data),
              else => error("Invalid dedicated treasury UTxO: Missing inline datum")
            };

          does_tx_contain_project_utxo: Bool =
            ( tx.ref_inputs.map((input: TxInput) -> TxOutput{input.output})
                + tx.outputs
            ).any(
              (output: TxOutput) -> Bool {
                output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                  && output.datum
                      .switch {
                        i: Inline => {
                          project_datum: ProjectDatum = ProjectDatum::from_data(i.data);

                          project_datum.project_id == datum.project_id
                            && project_datum.status.switch {
                              Active => true,
                              PreClosed => true,
                              PreDelisted => true,
                              else => false
                            }
                        },
                        else => false
                      }
              }
            );

          min_remaining_ada: Int =
            (1 + pparams_datum.min_treasury_per_milestone_event) * TREASURY_UTXO_MIN_ADA;

          withdrawn_ada: Int = min (
            datum.governor_ada,
            own_input_txinput.output.value.get_safe(AssetClass::ADA) - min_remaining_ada
          );

          is_own_output_valid: Bool =
            own_output_txout.value.get_safe(AssetClass::ADA)
              == own_input_txinput.output.value.get_safe(AssetClass::ADA) - withdrawn_ada
              && own_output_datum.project_id == datum.project_id
              && own_output_datum.governor_ada == datum.governor_ada - withdrawn_ada
              && own_output_datum.tag.switch {
                tag: TagContinuation => tag.former == own_input_txinput.output_id,
                else => false
              };

          is_tx_authorized: Bool =
            if(is_tx_authorized_by(tx, pparams_datum.governor_address.credential)){
              withdrawn_ada > 0
            } else {
              withdrawn_ada >= TREASURY_MIN_WITHDRAWAL_ADA
                && tx.outputs.any (
                  (output: TxOutput) -> Bool {
                    output.address == pparams_datum.governor_address
                      && output.value
                          == Value::lovelace(
                            withdrawn_ada * (MULTIPLIER - TREASURY_WITHDRAWAL_DISCOUNT_RATIO) / MULTIPLIER
                          )
                      && output.datum.switch {
                        i: Inline =>
                          UserTag::from_data(i.data).switch {
                            tag: TagTreasuryWithdrawal =>
                              tag.treasury_output_id.unwrap() == own_input_txinput.output_id,
                              else => false
                          },
                        else => false
                      }
                  }
                )
            };

          own_validator_hash
            == pparams_datum.registry.dedicated_treasury_validator.latest
            && is_own_output_valid
            && is_tx_authorized
            && does_tx_contain_project_utxo
        },
        Revoke => {
          does_tx_contain_project_utxo: Bool =
            ( tx.ref_inputs.map((input: TxInput) -> TxOutput{input.output})
                + tx.outputs
            ).any(
              (output: TxOutput) -> Bool {
                output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                  && output.datum
                      .switch {
                        i: Inline => {
                          project_datum: ProjectDatum = ProjectDatum::from_data(i.data);

                          project_datum.project_id == datum.project_id
                            && project_datum.status.switch {
                              Closed => true,
                              Delisted => true,
                              else => false
                            }
                        },
                        else => false
                      }
              }
            );

          ada_to_treasury: Int =
            own_input_txinput.output.value.get_safe(AssetClass::ADA)
              - pparams_datum.discount_cent_price * (MULTIPLIER - TREASURY_REVOKE_DISCOUNT_CENTS) / MULTIPLIER;

          does_produce_open_treasury_utxo_correctly: Bool =
            tx.outputs.any(
              (output: TxOutput) -> Bool {
                output.address == Address::new(
                  Credential::new_validator(
                    pparams_datum.registry.open_treasury_validator.latest
                  ),
                  Option[StakingCredential]::Some{
                    scriptHashToStakingCredential(
                      pparams_datum.registry.protocol_staking_validator
                    )
                  }
                )
                  && output.value.get_safe(AssetClass::ADA) >= ada_to_treasury
                  && output.datum.switch {
                    i: Inline => {
                      open_treasury_datum: OpenTreasuryDatum = OpenTreasuryDatum::from_data(i.data);
                      treasury_ada: Int = output.value.get_safe(AssetClass::ADA);

                      open_treasury_datum.governor_ada
                          == treasury_ada * pparams_datum.governor_share_ratio / MULTIPLIER
                        && open_treasury_datum.tag.switch {
                          tag: TagContinuation => tag.former == own_input_txinput.output_id,
                          else => false
                        }
                    },
                    else => false
                  }
              }
            );

          own_validator_hash
            == pparams_datum.registry.dedicated_treasury_validator.latest
            && does_tx_contain_project_utxo
            && if (ada_to_treasury > 0 ) {
              does_produce_open_treasury_utxo_correctly
            } else {
              true
            }
        },
        Migrate => {
          migration_asset_class: AssetClass =
            pparams_datum
              .registry
              .dedicated_treasury_validator
              .migrations
              .get(own_validator_hash);

          tx.minted.get_safe(migration_asset_class) != 0
        }
      }
    }

  `;
}
