import { helios } from "../../program";

export type Params = {
  projectsAuthTokenMph: string;
  protocolNftMph: string;
  teikiMph: string;
};

export default function main({
  projectsAuthTokenMph,
  protocolNftMph,
  teikiMph,
}: Params) {
  return helios`
    minting mp__proof_of_backing

    import {
      Redeemer,
      Plant,
      PlantAccumulator,
      to_fruit
    } from proof_of_backing_types
    import { Datum as BackingDatum } from v__backing__types
    import { Datum as ProjectDatum } from v__project__types
    import { Datum as ProjectScriptDatum } from v__project_script__types
    import { Datum as PParamsDatum } from v__protocol_params__types
    import {
      Datum as SharedTreasuryDatum,
      Redeemer as SharedTreasuryRedeemer
    } from v__shared_treasury__types
    import { UserTag } from common__types

    import {
      find_pparams_datum_from_inputs,
      is_tx_authorized_by,
      scriptHashToStakingCredential
    } from helpers

    import {
      INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      TEIKI_TOKEN_NAME
    } from constants

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const PROJECTS_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectsAuthTokenMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_SCRIPT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_SCRIPT_AT_TOKEN_NAME)

    const TEIKI_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${teikiMph})

    const TEIKI_ASSET_CLASS: AssetClass =
      AssetClass::new(TEIKI_MPH, TEIKI_TOKEN_NAME)

    // Seed token name is an empty ByteArray
    const SEED_TOKEN_NAME: ByteArray = #

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      seed_asset_class: AssetClass = AssetClass::new(own_mph, SEED_TOKEN_NAME);

      redeemer.switch {
        plant: Plant => {
          cleanup: Bool = plant.cleanup;

          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

          consumed_backing_txinputs: []TxInput =
            tx.inputs
              .filter(
                (input: TxInput) -> Bool {
                  input.output.value.get_safe(seed_asset_class) >= 1
                }
              );

          is_consumed_backing_empty: Bool = consumed_backing_txinputs.length == 0;

          produced_backing_txouts: []TxOutput =
            tx.outputs.filter(
              (output: TxOutput) -> Bool {
                output.value.get_safe(seed_asset_class) >= 1
              }
            );

          produced_backing_datums: []BackingDatum =
            produced_backing_txouts
            .map(
              (txout: TxOutput) -> BackingDatum {
                txout.datum.switch {
                  i: Inline => BackingDatum::from_data(i.data),
                  else => error("Invalid backing UTxO: missing inline datum")
                }
              }
            );

          is_produced_backing_empty: Bool = produced_backing_txouts.length == 0;

          assert (
            !(is_consumed_backing_empty && is_produced_backing_empty),
            "Must consume or produce backing UTxO"
          );

          assert (
            !(is_consumed_backing_empty && cleanup),
            "Must consume backing in cleaning up"
          );

          assert (
            !(!is_produced_backing_empty && cleanup),
            "Must not produce backing in cleaning up"
          );

          are_backing_credentials_valid: Bool =
            if(!is_consumed_backing_empty && !is_produced_backing_empty) {
              consumed_backing_txinputs.head.output.address.credential
                == produced_backing_txouts.head.address.credential
            } else {
              true
            };

          assert (
            are_backing_credentials_valid,
            "Must consume and produce the same credential backings"
          );

          case_consumed_backing_not_empty: Bool =
            if (is_consumed_backing_empty) { true }
            else {
              fisrt_consumed_backing_datum: BackingDatum =
                consumed_backing_txinputs.head.output.datum.switch {
                  i: Inline => BackingDatum::from_data(i.data),
                  else => error("Invalid backing UTxO: missing inline datum")
                };

              project_id: ByteArray = fisrt_consumed_backing_datum.project_id;
              consumed_backer_address: Address = fisrt_consumed_backing_datum.backer_address;

              project_txout: TxOutput =
                tx.ref_inputs.find(
                  (input: TxInput) -> Bool {
                    input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                  }
                )
                .output;

              project_datum: ProjectDatum =
                project_txout.datum.switch {
                  i: Inline => ProjectDatum::from_data(i.data),
                  else => error("Invalid Project utxo: missing inline datum")
                };

              is_project_datum_valid: Bool =
                project_datum.project_id == project_id
                  && if (cleanup) {
                    project_datum.status.switch {
                      PreClosed => true,
                      Closed => true,
                      Delisted => true,
                      else => error("Invalid project datum: wrong project status")
                    }
                  } else {
                    true
                  };

              assert(is_project_datum_valid, "Invalid project datum");

              discount: Int =
                if(cleanup) {
                  pparams_datum.discount_cent_price * INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS
                } else {
                  0
                };

              init_plant_accumulator: PlantAccumulator =
                PlantAccumulator {
                  plant_map: Map[ByteArray]Int{},
                  total_teiki_rewards: 0
                };

              plant_accumulator: PlantAccumulator =
                consumed_backing_txinputs
                  .fold (
                    (acc: PlantAccumulator, consumed_backing_txinput: TxInput) -> PlantAccumulator{
                      backing_datum: BackingDatum =
                        consumed_backing_txinput.output.datum.switch {
                          i: Inline => BackingDatum::from_data(i.data),
                          else => error("Invalid backing UTxO: missing inline datum")
                        };

                      unstaked_at: Time = tx.time_range.start;

                      is_consumed_backer_address_valid: Bool =
                        if (consumed_backing_txinput.output.address.credential
                              == Credential::new_validator(
                                  pparams_datum.registry
                                    .backing_validator
                                    .latest
                                )
                        ){
                          true
                        } else {
                          error("Invalid consumed backing address")
                        };

                      is_backing_datum_valid: Bool =
                        if (backing_datum.project_id == project_id) {
                          if(cleanup) {
                            true
                          } else {
                            if (backing_datum.backer_address == consumed_backer_address) {
                              true
                            } else {
                              error("Invalid backing datum: wrong backer address")
                            }
                          }
                        } else {
                          error("Invalid consumed backing datum: wrong project id")
                        };

                      is_unstaked_valid: Bool =
                        if (unstaked_at >= backing_datum.staked_at) {
                          true
                        } else {
                          error("Invalid unstaked time")
                        };

                      is_rewardable: Bool =
                        is_consumed_backer_address_valid
                          && is_backing_datum_valid
                          && is_unstaked_valid
                          && unstaked_at >= backing_datum.staked_at + pparams_datum.epoch_length;

                      if (is_rewardable) {
                        backing_amount: Int = consumed_backing_txinput.output.value.get_safe(AssetClass::ADA);

                        is_matured: Bool =
                          backing_datum.milestone_backed < project_datum.milestone_reached
                            && project_datum.status.switch {
                              PreDelisted => false,
                              else => true
                            };

                        new_plant: Plant =
                          Plant {
                            is_matured: is_matured,
                            backing_output_id: consumed_backing_txinput.output_id,
                            backing_amount: backing_amount,
                            unstaked_at: unstaked_at,
                            project_id: backing_datum.project_id,
                            backer_address: backing_datum.backer_address,
                            staked_at: backing_datum.staked_at,
                            milestone_backed: backing_datum.milestone_backed
                          };

                        plant_hash: ByteArray = new_plant.serialize().blake2b();

                        teiki_rewards: Int =
                          if(is_matured) {
                            backing_amount
                              * (unstaked_at - backing_datum.staked_at) / pparams_datum.epoch_length
                              / pparams_datum.teiki_coefficient
                          } else {
                            0
                          };

                        are_output_valid: Bool =
                          if (cleanup) {
                            tx.outputs.any(
                              (output: TxOutput) -> Bool {
                                output.address == backing_datum.backer_address
                                  && output.value.get_safe(AssetClass::ADA)
                                      == consumed_backing_txinput.output.value.get_safe(AssetClass::ADA) - discount
                                  && output.value.get_safe(TEIKI_ASSET_CLASS) == teiki_rewards
                                  && output.value.get_safe(AssetClass::new(own_mph, plant_hash)) == 1
                                  && output.datum.switch {
                                    i: Inline =>
                                      UserTag::from_data(i.data).switch {
                                        tag: TagInactiveBacking =>
                                          tag.backing_output_id == consumed_backing_txinput.output_id,
                                          else => false
                                      },
                                    else => error("Invalid output UTxO, missing inline datum")
                                  }
                              }
                            )
                          } else {
                            true
                          };

                        if(are_output_valid){
                          PlantAccumulator {
                            plant_map: acc.plant_map + Map[ByteArray]Int{plant_hash: 1},
                            total_teiki_rewards: acc.total_teiki_rewards + teiki_rewards
                          }
                        } else {
                          error("Invalid outputs: missing backer outputs")
                        }
                      } else {
                        acc
                      }
                    },
                    init_plant_accumulator
                  );

              does_consume_treasury_correctly: Bool =
                if (plant_accumulator.total_teiki_rewards > 0) {
                  total_teiki_rewards: Int = plant_accumulator.total_teiki_rewards;

                  shared_treasury_credential: Credential =
                    Credential::new_validator(
                      pparams_datum.registry
                        .shared_treasury_validator
                        .latest
                    );

                  shared_treasury_txinput: TxInput =
                    tx.inputs.find(
                      (input: TxInput) -> Bool {
                        input_credential: Credential = input.output.address.credential;

                        if (input_credential == shared_treasury_credential) {
                            input.output.datum.switch {
                              i: Inline =>
                                SharedTreasuryDatum::from_data(i.data).project_id
                                  == project_id,
                              else => false
                            }
                        } else {
                          false
                        }
                      }
                    );

                  treasury_script_purpose: ScriptPurpose =
                    ScriptPurpose::new_spending(shared_treasury_txinput.output_id);

                  share_treasury_redeemer_data: Data =
                    tx.redeemers.get(treasury_script_purpose);

                  share_treasury_update_teiki_redeemer: SharedTreasuryRedeemer::UpdateTeiki =
                    SharedTreasuryRedeemer::from_data(share_treasury_redeemer_data).switch {
                      update_teiki: UpdateTeiki => update_teiki,
                      else => error("Invalid share treasury redeemer")
                    };

                  does_update_teiki_reward_correctly: Bool =
                    share_treasury_update_teiki_redeemer.rewards == total_teiki_rewards;

                  teiki_mint: Int =
                    project_datum.status.switch {
                      Delisted => share_treasury_update_teiki_redeemer.burn_action.switch {
                        BurnEntirely => 2 * total_teiki_rewards - share_treasury_update_teiki_redeemer.burn_amount,
                        else => error("Invalid burn action")
                      },
                      else => {
                        share_treasury_update_teiki_redeemer.burn_action.switch {
                          BurnPeriodically => 3 * total_teiki_rewards - share_treasury_update_teiki_redeemer.burn_amount,
                          else => error("Invalid burn action")
                        }
                      }
                    };

                  teiki_minted: Int = tx.minted.get_safe(TEIKI_ASSET_CLASS);

                  does_update_teiki_reward_correctly
                    && ( teiki_minted == teiki_mint || teiki_minted == 0 - teiki_mint)
                } else {
                  tx.minted.to_map().get_safe(TEIKI_MPH).switch {
                      None => true,
                      else => false
                    }
                };

              seed_mint_amount: Int =
                produced_backing_txouts.length - consumed_backing_txinputs.length;

              does_mint_correctly: Bool =
                tx.minted.to_map().get(own_mph).all(
                  (token_name: ByteArray, amount: Int) -> Bool {
                    if (token_name == SEED_TOKEN_NAME) { amount == seed_mint_amount }
                    else {
                      plant_accumulator.plant_map.get_safe(token_name).switch {
                        None => error("Mint incorrect plant token"),
                        s: Some => amount == s.some
                      }
                    }
                  }
                );

              assert(does_mint_correctly, "Proof of backing: Mint incorrectly value");

              does_consume_treasury_correctly
                && is_tx_authorized_by(tx, consumed_backer_address.credential)

            };

          case_produced_backing_not_empty: Bool =
            if(is_produced_backing_empty) { true }
            else {
              if (cleanup) { error("Invalid case")}
              else {
                project_txout: TxOutput =
                  tx.ref_inputs.find(
                    (input: TxInput) -> Bool {
                      input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                    }
                  )
                  .output;

                project_datum: ProjectDatum =
                  project_txout.datum.switch {
                    i: Inline => ProjectDatum::from_data(i.data),
                    else => error("Invalid Project utxo: missing inline datum")
                  };

                is_project_datum_status_valid: Bool =
                  project_datum.status.switch {
                    Active => true,
                    else => false
                  };

                assert(is_project_datum_status_valid, "Invalid project status");

                project_id: ByteArray = produced_backing_datums.head.project_id;
                produced_backer_address: Address = produced_backing_datums.head.backer_address;

                project_script_txout: TxOutput =
                  tx.ref_inputs.find(
                    (input: TxInput) -> Bool {
                      input.output.value.get_safe(PROJECT_SCRIPT_AT_ASSET_CLASS) == 1
                    }
                  )
                  .output;

                project_script_datum: ProjectScriptDatum =
                  project_script_txout.datum.switch {
                    i: Inline => ProjectScriptDatum::from_data(i.data),
                    else => error("Invalid Project script utxo: missing inline datum")
                  };

                ref_option_staking_credential: Option[StakingCredential] =
                  Option[StakingCredential]::Some{
                    scriptHashToStakingCredential(
                      project_script_txout.ref_script_hash.unwrap()
                    )
                  };

                are_produced_backing_datums_valid: Bool =
                  produced_backing_datums.all(
                    (produced_backing_datum: BackingDatum) -> Bool {
                      produced_backing_datum.backer_address == produced_backer_address
                        && produced_backing_datum.staked_at == tx.time_range.end
                        && produced_backing_datum.milestone_backed == project_datum.milestone_reached
                    }
                  );

                assert(are_produced_backing_datums_valid, "Invalid produced backing datums");

                assert(
                  is_tx_authorized_by(tx, produced_backer_address.credential),
                  "Transaction is not authorized by produced backer address"
                );

                assert(
                  project_datum.project_id == project_id,
                  "Reference incorrect project UTxO (incorrect project id)"
                );
                assert(
                  project_script_datum.project_id == project_id,
                  "Reference incorrect project script UTxO (incorrect project id)"
                );

                produced_backing_txouts.all(
                  (output: TxOutput) -> Bool {
                    output.address == Address::new (
                      Credential::new_validator(
                        pparams_datum.registry
                          .backing_validator
                          .latest
                      ),
                      ref_option_staking_credential
                    )
                  }
                )
              }
            };

          case_consumed_backing_not_empty
            && case_produced_backing_not_empty

        },
        claim_rewards: ClaimRewards => {
          flowers: []Plant = claim_rewards.flowers;

          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

          project_id: ByteArray = claim_rewards.flowers.head.project_id;

          project_txout: TxOutput =
            tx.ref_inputs
              .find(
                (input: TxInput) -> Bool {
                  input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                }
              )
              .output;

          project_datum: ProjectDatum =
            project_txout.datum.switch {
              i: Inline => ProjectDatum::from_data(i.data),
              else => error("Invalid Project utxo: missing inline datum")
            };

          is_project_datum_valid: Bool =
            project_datum.project_id == project_id
              && project_datum.status.switch {
                PreDelisted => false,
                else => true
              };

          are_flowers_valid: Bool =
            flowers.all(
              (flower: Plant) -> Bool {
                flower.project_id == project_datum.project_id
                  && flower.milestone_backed < project_datum.milestone_reached
              }
            );

          are_flowers_sorted: Bool =
            flowers.fold(
              (acc: []Plant, flower: Plant) -> []Plant {
                if (acc.length == 0) {
                  []Plant{flower} + acc
                } else {
                  if(flower.backing_output_id > acc.head.backing_output_id) {
                    []Plant{flower} + acc
                  } else {
                    acc
                  }
                }
              },
              []Plant{}
            )
            .length == flowers.length;

          plant_minting_map: Map[ByteArray]Int =
            flowers.fold(
              (acc: Map[ByteArray]Int, flower: Plant) -> Map[ByteArray]Int {
                fruit: Plant = to_fruit(flower);

                acc + Map[ByteArray]Int{
                  flower.serialize().blake2b(): 0 - 1,
                  fruit.serialize().blake2b(): 1
                }
              },
              Map[ByteArray]Int{}
            );

          total_teiki_rewards: Int =
            flowers.fold(
              (acc: Int, flower: Plant) -> Int {
                teiki_rewards: Int =
                  flower.backing_amount
                    * (flower.unstaked_at - flower.staked_at) / pparams_datum.epoch_length
                    / pparams_datum.teiki_coefficient;

                acc + teiki_rewards
              },
              0
            );

          shared_treasury_txinput: TxInput =
            tx.inputs.find(
              (input: TxInput) -> Bool {
                input.output.address.credential
                  == Credential::new_validator(
                      pparams_datum.registry
                        .shared_treasury_validator
                        .latest
                    )
              }
            );

          shared_treasury_datum: SharedTreasuryDatum =
            shared_treasury_txinput.output.datum.switch {
              i: Inline => SharedTreasuryDatum::from_data(i.data),
              else => error("Invalid shared treasury UTxO: missing inline datum")
            };

          shared_treasury_script_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(shared_treasury_txinput.output_id);

          shared_treasury_redeemer_data: Data =
            tx.redeemers.get(shared_treasury_script_purpose);

          share_treasury_update_teiki_redeemer: SharedTreasuryRedeemer::UpdateTeiki =
            SharedTreasuryRedeemer::from_data(shared_treasury_redeemer_data).switch {
              update_teiki: UpdateTeiki => update_teiki,
              else => error("Invalid share treasury redeemer")
            };

          teiki_mint: Int =
            project_datum.status.switch {
              Delisted => share_treasury_update_teiki_redeemer.burn_action.switch {
                BurnEntirely => 2 * total_teiki_rewards - share_treasury_update_teiki_redeemer.burn_amount,
                else => error("Invalid burn action")
              },
              else => {
                share_treasury_update_teiki_redeemer.burn_action.switch {
                  BurnPeriodically => 3 * total_teiki_rewards - share_treasury_update_teiki_redeemer.burn_amount,
                  else => error("Invalid burn action")
                }
              }
            };

          teiki_minted: Int = tx.minted.get_safe(TEIKI_ASSET_CLASS);

          does_mint_teiki_reward_correctly: Bool =
            teiki_minted == teiki_mint || teiki_minted == 0 - teiki_mint;

          is_project_datum_valid
            && shared_treasury_datum.project_id == project_id
            && are_flowers_valid
            && are_flowers_sorted
            && does_mint_teiki_reward_correctly
            && tx.minted.to_map().get(own_mph) == plant_minting_map // TODO: check this
        },
        Migrate => {
          tx.outputs.all(
            (output: TxOutput) -> Bool {
              !output.value.contains_policy(own_mph)
            }
          )
        }
      }
    }
  `;
}
