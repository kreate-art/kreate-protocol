import { PROOF_OF_BACKING_TOKEN_NAMES } from "@/contracts/common/constants";
import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  projectAtMph: Hex;
  protocolNftMph: Hex;
  teikiMph: Hex;
};

export default function main({
  projectAtMph,
  protocolNftMph,
  teikiMph,
}: Params) {
  return helios`
    ${header("minting", "mp__proof_of_backing")}

    import {
      ADA_MINTING_POLICY_HASH,
      ADA_TOKEN_NAME,
      INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      PROOF_OF_BACKING_MIGRATE_IN,
      PROOF_OF_BACKING_PLANT_TX_TIME_SLIPPAGE,
      TEIKI_TOKEN_NAME
    } from ${module("constants")}

    import {
      find_pparams_datum_from_inputs,
      is_tx_authorized_by,
      script_hash_to_staking_credential
    } from ${module("helpers")}

    import { UserTag }
      from ${module("common__types")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import { Datum as ProjectDatum, ProjectStatus }
      from ${module("v__project__types")}

    import { Datum as ProjectScriptDatum }
      from ${module("v__project_script__types")}

    import {
      Datum as SharedTreasuryDatum,
      Redeemer as SharedTreasuryRedeemer
    } from ${module("v__shared_treasury__types")}

    import { Datum as BackingDatum }
      from ${module("v__backing__types")}

    import { Redeemer, Plant }
      from ${module("mp__proof_of_backing__types")}

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const PROJECT_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectAtMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_SCRIPT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_SCRIPT_AT_TOKEN_NAME)

    const TEIKI_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${teikiMph})

    const TEIKI_ASSET_CLASS: AssetClass =
      AssetClass::new(TEIKI_MPH, TEIKI_TOKEN_NAME)

    const SEED_TOKEN_NAME: ByteArray = #${PROOF_OF_BACKING_TOKEN_NAMES.SEED}
    const WILTED_FLOWER_TOKEN_NAME: ByteArray =
      #${PROOF_OF_BACKING_TOKEN_NAMES.WILTED_FLOWER}

    struct PlantAccumulator {
      plant_map: Map[ByteArray]Int
      total_teiki_rewards: Int
      wilted_amount: Int
    }

    func to_fruit(flower: Plant) -> Plant {
      Plant {
        is_matured: true,
        backing_output_id: flower.backing_output_id,
        backing_amount: flower.backing_amount,
        unbacked_at: flower.unbacked_at,
        project_id: flower.project_id,
        backer_address: flower.backer_address,
        backed_at: flower.backed_at,
        milestone_backed: flower.milestone_backed
      }
    }

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      redeemer.switch {

        plant: Plant => {
          tx_time_start: Time = tx.time_range.start;

          assert(
            tx_time_start >= tx.time_range.end - PROOF_OF_BACKING_PLANT_TX_TIME_SLIPPAGE,
            "Invalid time range"
          );

          cleanup: Bool = plant.cleanup;

          seed_asset_class: AssetClass = AssetClass::new(own_mph, SEED_TOKEN_NAME);

          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

          consumed_backing_inputs: []TxInput =
            tx.inputs.filter(
              (input: TxInput) -> {
                amount: Int = input.output.value.get_safe(seed_asset_class);
                if (amount == 0) { false }
                else if (amount == 1) { true }
                else {
                  error("Backing UTxO contains more than one seed token")
                }
              }
            );

          is_consumed_backing_empty: Bool = consumed_backing_inputs.is_empty();

          produced_backing_outputs: []TxOutput =
            tx.outputs.filter(
              (output: TxOutput) -> {
                output.value.get_safe(seed_asset_class) >= 1
              }
            );

          is_produced_backing_empty: Bool = produced_backing_outputs.is_empty();

          if (cleanup) {
            assert(!is_consumed_backing_empty, "Must consume backing in cleaning up");
            assert(is_produced_backing_empty, "Must not produce backing in cleaning up")
          };

          backing_credential: Credential =
            Credential::new_validator(
              pparams_datum.registry.backing_validator.latest
            );

          consumed_backer_credential: Option[Credential] =
            if (is_consumed_backing_empty) { Option[Credential]::None }
            else {
              first_backing_datum: BackingDatum =
                consumed_backing_inputs.head.output.datum.switch {
                  i: Inline => BackingDatum::from_data(i.data),
                  else => error("Invalid backing UTxO: missing inline datum")
                };

              project_id: ByteArray = first_backing_datum.project_id;
              first_backer_address: Address = first_backing_datum.backer_address;

              project_output: TxOutput =
                tx.ref_inputs.find(
                  (input: TxInput) -> {
                    input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                  }
                )
                .output;

              project_datum: ProjectDatum =
                project_output.datum.switch {
                  i: Inline => ProjectDatum::from_data(i.data),
                  else => error("Invalid project UTxO: missing inline datum")
                };

              assert(project_datum.project_id == project_id, "Invalid project datum");

              project_status: ProjectStatus = project_datum.status;

              discount: Int =
                if (cleanup) {
                  assert(
                    project_status.switch {
                      Closed => true,
                      Delisted => true,
                      else => false
                    },
                    "Invalid project datum: wrong project status"
                  );
                  pparams_datum.discount_cent_price * INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS
                } else {
                  0
                };

              unbacked_at: Time =
                project_status.switch {
                  closed: Closed =>
                    if (closed.closed_at < tx_time_start) { closed.closed_at }
                    else { tx_time_start },
                  delisted: Delisted =>
                    if (delisted.delisted_at < tx_time_start) { delisted.delisted_at }
                    else { tx_time_start },
                  else => tx_time_start
                };

              epoch_length: Duration = pparams_datum.epoch_length;
              teiki_coefficient: Int = pparams_datum.teiki_coefficient;

              init_plant_accumulator: PlantAccumulator =
                PlantAccumulator {
                  plant_map: Map[ByteArray]Int {},
                  total_teiki_rewards: 0,
                  wilted_amount: 0
                };

              plant_accumulator: PlantAccumulator =
                consumed_backing_inputs.fold(
                  (acc: PlantAccumulator, backing_input: TxInput) -> PlantAccumulator {
                    backing_output: TxOutput = backing_input.output;

                    backing_datum: BackingDatum =
                      backing_output.datum.switch {
                        i: Inline => BackingDatum::from_data(i.data),
                        else => error("Invalid backing UTxO: missing inline datum")
                      };

                    assert(
                      backing_output.address.credential == backing_credential,
                      "Invalid consumed backing address"
                    );

                    backer_address: Address = backing_datum.backer_address;

                    assert(
                      backing_datum.project_id == project_id
                        && (cleanup || backer_address == first_backer_address),
                      "Invalid backing datum"
                    );

                    backed_at: Time = backing_datum.backed_at;
                    time_passed: Duration = unbacked_at - backing_datum.backed_at;

                    if (time_passed < Duration::new(0)) {
                      error("Invalid unback time")
                    } else if (time_passed < epoch_length) {
                      if (cleanup) {
                        assert(
                          tx.outputs.any(
                            (output: TxOutput) -> {
                              ada_to_backer: Int = backing_output.value.get(AssetClass::ADA) - discount;
                              output.address == backer_address
                                && output.value.to_map().all(
                                    (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> {
                                      if (mph == own_mph) {
                                        tokens == Map[ByteArray]Int {WILTED_FLOWER_TOKEN_NAME: 1}
                                      } else if (mph == ADA_MINTING_POLICY_HASH) {
                                        tokens.get(ADA_TOKEN_NAME) >= ada_to_backer
                                      } else {
                                        false
                                      }
                                    }
                                  )
                                && output.datum.switch {
                                  i: Inline =>
                                    UserTag::from_data(i.data).switch {
                                      tag: TagInactiveBacking =>
                                        tag.backing_output_id == backing_input.output_id,
                                        else => false
                                    },
                                  else => error("Invalid output UTxO, missing inline datum")
                                }
                            }
                          ),
                          "Haven't paid to backer"
                        )
                      };

                      PlantAccumulator {
                        plant_map: acc.plant_map,
                        total_teiki_rewards: acc.total_teiki_rewards,
                        wilted_amount: acc.wilted_amount + 1
                      }
                    } else {
                      backing_amount: Int = backing_output.value.get(AssetClass::ADA);

                      milestone_backed: Int = backing_datum.milestone_backed;

                      is_matured: Bool =
                        milestone_backed < project_datum.milestone_reached
                          && project_datum.status.switch {
                            PreDelisted => false,
                            else => true
                          };

                      new_plant: Plant =
                        Plant {
                          is_matured: is_matured,
                          backing_output_id: backing_input.output_id,
                          backing_amount: backing_amount,
                          unbacked_at: unbacked_at,
                          project_id: project_id,
                          backer_address: backer_address,
                          backed_at: backed_at,
                          milestone_backed: milestone_backed
                        };

                      plant_hash: ByteArray = new_plant.serialize().blake2b();

                      teiki_rewards: Int =
                        if (is_matured) {
                          backing_amount
                            * ((unbacked_at - backed_at) / epoch_length)
                            / teiki_coefficient
                        } else {
                          0
                        };

                      if (cleanup) {
                        assert(
                          tx.outputs.any(
                            (output: TxOutput) -> Bool {
                              ada_to_backer: Int = backing_output.value.get(AssetClass::ADA) - discount;
                              output.address == backer_address
                                && output.value.to_map().all(
                                    (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> {
                                      if (mph == TEIKI_MPH) {
                                        tokens == Map[ByteArray]Int {TEIKI_TOKEN_NAME: teiki_rewards}
                                      } else if (mph == own_mph) {
                                        tokens == Map[ByteArray]Int {plant_hash: 1}
                                      } else if (mph == ADA_MINTING_POLICY_HASH) {
                                        tokens.get(ADA_TOKEN_NAME) >= ada_to_backer
                                      } else {
                                        false
                                      }
                                    }
                                  )
                                && output.datum.switch {
                                  i: Inline =>
                                    UserTag::from_data(i.data).switch {
                                      tag: TagInactiveBacking =>
                                        tag.backing_output_id == backing_input.output_id,
                                        else => false
                                    },
                                  else => error("Invalid output UTxO, missing inline datum")
                                }
                            }
                          ),
                          "Haven't paid to backer"
                        )
                      };

                      PlantAccumulator {
                        plant_map: acc.plant_map.prepend(plant_hash, 1),
                        total_teiki_rewards: acc.total_teiki_rewards + teiki_rewards,
                        wilted_amount: acc.wilted_amount
                      }

                    }
                  },
                  init_plant_accumulator
                );

              total_teiki_rewards: Int = plant_accumulator.total_teiki_rewards;

              if (total_teiki_rewards > 0) {
                shared_treasury_credential: Credential =
                  Credential::new_validator(
                    pparams_datum.registry.shared_treasury_validator.latest
                  );

                shared_treasury_input: TxInput =
                  tx.inputs.find(
                    (input: TxInput) -> {
                      output: TxOutput = input.output;
                      if (output.address.credential == shared_treasury_credential) {
                        output.datum.switch {
                          i: Inline => SharedTreasuryDatum::from_data(i.data).project_id == project_id,
                          else => false
                        }
                      } else {
                        false
                      }
                    }
                  );

                shared_treasury_purpose: ScriptPurpose =
                  ScriptPurpose::new_spending(shared_treasury_input.output_id);

                share_treasury_redeemer: Data =
                  tx.redeemers.get(shared_treasury_purpose);

                shared_treasury_update_teiki: SharedTreasuryRedeemer::UpdateTeiki =
                  SharedTreasuryRedeemer::from_data(share_treasury_redeemer).switch {
                    update_teiki: UpdateTeiki => {
                      assert(
                        update_teiki.rewards == total_teiki_rewards,
                        "Teiki rewards must match"
                      );
                      update_teiki
                    },
                    else => error("Invalid share treasury redeemer")
                  };

                teiki_to_mint: Int =
                  project_datum.status.switch {
                    Delisted => shared_treasury_update_teiki.burn_action.switch {
                      BurnEntirely => 2 * total_teiki_rewards - shared_treasury_update_teiki.burn_amount,
                      else => error("Invalid burn action")
                    },
                    else => {
                      shared_treasury_update_teiki.burn_action.switch {
                        BurnPeriodically => 3 * total_teiki_rewards - shared_treasury_update_teiki.burn_amount,
                        else => error("Invalid burn action")
                      }
                    }
                  };

                teiki_minted: Int = tx.minted.get_safe(TEIKI_ASSET_CLASS);

                assert(teiki_minted == teiki_to_mint, "Mint incorrect Teiki amount")
              } else {
                assert(!tx.minted.contains_policy(TEIKI_MPH), "Must not mint any Teiki")
              };

              add_seed =
                (tokens: Map[ByteArray]Int) -> {
                  seed_amount: Int =
                    produced_backing_outputs.length - consumed_backing_inputs.length;
                  if (seed_amount != 0) { tokens.prepend(SEED_TOKEN_NAME, seed_amount) }
                  else { tokens }
                };

              add_wilted =
                (tokens: Map[ByteArray]Int) -> {
                  wilted_amount: Int = plant_accumulator.wilted_amount;
                  if (wilted_amount != 0) { tokens.prepend(WILTED_FLOWER_TOKEN_NAME, wilted_amount) }
                  else { tokens }
                };

              plants: Map[ByteArray]Int = plant_accumulator.plant_map;

              assert(
                add_seed(add_wilted(plants))
                  .sort((t1: ByteArray, _, t2: ByteArray, _) -> { t1 < t2 })
                  == tx.minted.get_policy(own_mph),
                "Incorrect Proof of Backing mint"
              );

              Option[Credential]::Some { first_backer_address.credential }
            };

          produced_backer_credential: Option[Credential] =
            if (is_produced_backing_empty) { Option[Credential]::None }
            else {
              backer_address: Address =
                produced_backing_outputs.head.datum.switch {
                  i: Inline => BackingDatum::from_data(i.data).backer_address,
                  else => error("Invalid backing UTxO: missing inline datum")
                };

              produced_backing_outputs.for_each(
                (output: TxOutput) -> {
                  assert(
                    output.value.to_map().all(
                      (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> {
                        if (mph == own_mph) {
                          tokens == Map[ByteArray]Int {SEED_TOKEN_NAME: 1}
                        } else {
                          mph == ADA_MINTING_POLICY_HASH
                        }
                      }
                    ),
                    "Incorrect backing value"
                  );

                  backing_datum: BackingDatum = output.datum.switch {
                    i: Inline => BackingDatum::from_data(i.data),
                    else => error("Invalid backing UTxO: missing inline datum")
                  };

                  project_id: ByteArray = backing_datum.project_id;

                  project_output: TxOutput =
                    tx.ref_inputs.find(
                      (input: TxInput) -> {
                        input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                      }
                    )
                    .output;

                  project_datum: ProjectDatum =
                    project_output.datum.switch {
                      i: Inline => ProjectDatum::from_data(i.data),
                      else => error("Invalid project UTxO: missing inline datum")
                    };

                  is_project_active: Bool =
                    project_datum.status.switch {
                      Active => true,
                      else => false
                    };
                  assert(is_project_active, "Project must be active");

                  project_script_output: TxOutput =
                    tx.ref_inputs.find(
                      (input: TxInput) -> {
                        input.output.value.get_safe(PROJECT_SCRIPT_AT_ASSET_CLASS) == 1
                      }
                    )
                    .output;

                  project_script_datum: ProjectScriptDatum =
                    project_script_output.datum.switch {
                      i: Inline => ProjectScriptDatum::from_data(i.data),
                      else => error("Invalid project script UTxO: missing inline datum")
                    };

                  assert(
                    project_datum.project_id == project_id,
                    "Reference incorrect project UTxO (incorrect project id)"
                  );

                  assert(
                    project_script_datum.project_id == project_id,
                    "Reference incorrect project script UTxO (incorrect project id)"
                  );

                  assert(
                    backing_datum.backer_address == backer_address
                      && backing_datum.backed_at == tx_time_start
                      && backing_datum.milestone_backed == project_datum.milestone_reached,
                    "Incorrect backing datum"
                  );

                  assert(
                    output.address == Address::new(
                      backing_credential,
                      Option[StakingCredential]::Some {
                        script_hash_to_staking_credential(
                          project_script_output.ref_script_hash.unwrap()
                        )
                      }
                    ),
                    "Incorrect backing address"
                  )
                }
              );

              Option[Credential]::Some { backer_address.credential }
            };

          consumed_backer_credential.switch {
            None => produced_backer_credential.switch {
              None => {
                error("Must consume or produce backing UTxO")
              },
              sp: Some => {
                assert(
                  is_tx_authorized_by(tx, sp.some)
                    || is_tx_authorized_by(tx, pparams_datum.governor_address.credential),
                  "Transaction must be authorized by the (produced) backer or governor"
                )
              }
            },
            sc: Some => produced_backer_credential.switch {
              None => {
                assert(
                  cleanup || is_tx_authorized_by(tx, sc.some),
                  "Transaction must be cleaning up or authorized by the (consumed) backer"
                )
              },
              sp: Some => {
                assert(
                  sc.some == sp.some,
                  "Must consume and produce the same credential backings"
                );
                assert(
                  is_tx_authorized_by(tx, sc.some),
                  "Transaction must be authorized by the (same) backer"
                )
              }
            }
          };

          true
        },

        claim_rewards: ClaimRewards => {
          flowers: []Plant = claim_rewards.flowers;

          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

          project_id: ByteArray = flowers.head.project_id;

          project_output: TxOutput =
            tx.ref_inputs
              .find(
                (input: TxInput) -> Bool {
                  input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                }
              )
              .output;

          project_datum: ProjectDatum =
            project_output.datum.switch {
              i: Inline => ProjectDatum::from_data(i.data),
              else => error("Invalid Project utxo: missing inline datum")
            };
          project_status: ProjectStatus = project_datum.status;
          project_milestone: Int = project_datum.milestone_reached;

          is_project_datum_valid: Bool =
            project_datum.project_id == project_id
              && project_status.switch {
                PreDelisted => false,
                else => true
              };
          assert(is_project_datum_valid, "Invalid project datum");

          _ignored: TxOutputId =
            flowers.fold(
              (last_id: TxOutputId, flower: Plant) ->  {
                current_id: TxOutputId = flower.backing_output_id;
                assert(current_id > last_id, "Flowers are not sorted");
                assert(
                  !flower.is_matured
                    && flower.project_id == project_id
                    && flower.milestone_backed < project_milestone,
                  "Invalid flower"
                );
                current_id
              },
              TxOutputId::new(TxId::new(#), 0)
            );
          assert(_ignored.index >= 0, "invalid flowers");

          plant_minting_map: Map[ByteArray]Int =
            flowers.fold(
              (acc: Map[ByteArray]Int, flower: Plant) -> {
                acc
                  .prepend(flower.serialize().blake2b(), -1)
                  .prepend(to_fruit(flower).serialize().blake2b(), 1)
              },
              Map[ByteArray]Int {}
            );

          epoch_length: Duration = pparams_datum.epoch_length;
          teiki_coefficient: Int = pparams_datum.teiki_coefficient;
          total_teiki_rewards: Int =
            flowers.fold(
              (acc: Int, flower: Plant) -> {
                teiki_rewards: Int =
                  flower.backing_amount
                    * ((flower.unbacked_at - flower.backed_at) / epoch_length)
                    / teiki_coefficient;
                assert(teiki_rewards > 0, "flower is not ready yet");
                acc + teiki_rewards
              },
              0
            );

          shared_treasury_credential: Credential =
            Credential::new_validator(
              pparams_datum.registry.shared_treasury_validator.latest
            );

          shared_treasury_input: TxInput =
            tx.inputs.find(
              (input: TxInput) -> {
                input.output.address.credential == shared_treasury_credential
              }
            );

          shared_treasury_datum: SharedTreasuryDatum =
            shared_treasury_input.output.datum.switch {
              i: Inline => SharedTreasuryDatum::from_data(i.data),
              else => error("Invalid shared treasury UTxO: missing inline datum")
            };

          assert(
            shared_treasury_datum.project_id == project_id,
            "Incorrect project id shared treasury input"
          );

          shared_treasury_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(shared_treasury_input.output_id);

          shared_treasury_redeemer: Data =
            tx.redeemers.get(shared_treasury_purpose);

          shared_treasury_update_teiki: SharedTreasuryRedeemer::UpdateTeiki =
            SharedTreasuryRedeemer::from_data(shared_treasury_redeemer).switch {
              update_teiki: UpdateTeiki => {
                assert(
                  update_teiki.rewards == total_teiki_rewards,
                  "Teiki rewards must match"
                );
                update_teiki
              },
              else => error("Invalid share treasury redeemer")
            };

          teiki_to_mint: Int =
            project_datum.status.switch {
              Delisted => shared_treasury_update_teiki.burn_action.switch {
                BurnEntirely => 2 * total_teiki_rewards - shared_treasury_update_teiki.burn_amount,
                else => error("Invalid burn action")
              },
              else => shared_treasury_update_teiki.burn_action.switch {
                BurnPeriodically => 3 * total_teiki_rewards - shared_treasury_update_teiki.burn_amount,
                else => error("Invalid burn action")
              }
            };

          teiki_minted: Int = tx.minted.get_safe(TEIKI_ASSET_CLASS);

          assert(teiki_minted == teiki_to_mint, "Mint incorrect Teiki amount");

          tx.minted.get_policy(own_mph)
            == plant_minting_map.sort((t1: ByteArray, _, t2: ByteArray, _) -> { t1 < t2 })
        },

        MigrateOut => {
          tx.minted.get_safe(TEIKI_ASSET_CLASS) <= 0
            && !tx.outputs.any(
                (output: TxOutput) -> Bool {
                  output.value.contains_policy(own_mph)
                }
              )
        },

        MigrateIn => {
          PROOF_OF_BACKING_MIGRATE_IN.switch {
            None => error("No PROOF_OF_BACKING_MIGRATE_IN"),
            s: Some => tx.minted.contains_policy(s.some)
          }
        },

        Burn => {
          tx.minted.get_policy(own_mph).all(
            (_, amount: Int) -> Bool { amount < 0 }
          )
        }

      }
    }
  `;
}
