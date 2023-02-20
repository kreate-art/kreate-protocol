import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  projectAtMph: Hex;
  protocolNftMph: Hex;
};

export default function main({ projectAtMph, protocolNftMph }: Params) {
  return helios`
    ${header("spending", "v__project")}

    import {
      ADA_MINTING_POLICY_HASH,
      ADA_TOKEN_NAME,
      INACTIVE_PROJECT_UTXO_ADA,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_CLOSE_DISCOUNT_CENTS,
      PROJECT_DELIST_DISCOUNT_CENTS,
      PROJECT_DETAIL_AT_TOKEN_NAME,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      PROJECT_IMMEDIATE_CLOSURE_TX_TIME_SLIPPAGE,
      PROJECT_SCRIPT_UTXO_ADA,
      RATIO_MULTIPLIER
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

    import { Datum as OpenTreasuryDatum }
      from ${module("v__open_treasury__types")}

    import { Datum as ProjectScriptDatum }
      from ${module("v__project_script__types")}

    import {
      Datum as ProjectDetailDatum,
      Redeemer as ProjectDetailRedeemer
    } from ${module("v__project_detail__types")}

    import { Redeemer, Datum, ProjectStatus }
      from ${module("v__project__types")}

    const PROJECT_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectAtMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_DETAIL_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_DETAIL_AT_TOKEN_NAME)

    const PROJECT_SCRIPT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_SCRIPT_AT_TOKEN_NAME)

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      own_spending_output: TxOutput = ctx.get_current_input().output;

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      redeemer.switch {

        Migrate => {
          migration_asset_class: AssetClass =
            pparams_datum
              .registry
              .project_validator
              .migrations
              .get(own_validator_hash);

          tx.minted.get_safe(migration_asset_class) != 0
        },

        else => {
          assert(
            own_validator_hash
              == pparams_datum.registry.project_validator.latest,
            "Wrong script version"
          );

          redeemer.switch {
            record: RecordNewMilestone => {
              project_id: ByteArray = datum.project_id;

              assert(
                record.new_milestone > datum.milestone_reached,
                "Invalid new milestone"
              );

              project_detail_output_id: TxOutputId =
                tx.inputs
                  .find(
                    (input: TxInput) -> {
                      output: TxOutput = input.output;
                      output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                        && output.datum.switch {
                            i: Inline =>
                              ProjectDetailDatum::from_data(i.data).project_id == project_id,
                            else => false
                          }
                    }
                  )
                  .output_id;

              project_detail_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_detail_output_id);

              project_detail_redeemer: Data =
                tx.redeemers.get(project_detail_purpose);

              assert(
                ProjectDetailRedeemer::from_data(project_detail_redeemer).switch {
                  WithdrawFunds => true,
                  else => false
                },
                "Wrong project detail redeemer"
              );

              tx.outputs.any(
                (output: TxOutput) -> Bool {
                  output.address == own_spending_output.address
                    && output.value == own_spending_output.value
                    && output.datum.switch {
                      i: Inline => {
                        output_datum: Datum = Datum::from_data(i.data);

                        output_datum.milestone_reached == record.new_milestone
                          && output_datum.project_id == project_id
                          && output_datum.owner_address == datum.owner_address
                          && output_datum.status == datum.status
                          && output_datum.is_staking_delegation_managed_by_protocol
                              == datum.is_staking_delegation_managed_by_protocol
                      },
                      else => error("Invalid project UTxO: missing inline datum")
                    }
                }
              )
            },

            allocate: AllocateStakingValidator => {
              new_staking_credential: StakingCredential =
                StakingCredential::new_hash(
                  StakingHash::new_validator(allocate.new_staking_validator)
                );

              assert(
                is_tx_authorized_by(tx, datum.owner_address.credential)
                  || is_tx_authorized_by(tx, pparams_datum.staking_manager)
                  || is_tx_authorized_by(tx, pparams_datum.governor_address.credential),
                "Transaction is not authorized"
              );

              assert(
                datum.status.switch {
                  Active => true,
                  else => false
                },
                "Wrong project status"
              );

              own_address: Address = own_spending_output.address;

              min_producing_project_ada: Int =
                own_spending_output.value.get_safe(AssetClass::ADA)
                  - pparams_datum.stake_key_deposit
                  - PROJECT_SCRIPT_UTXO_ADA;

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == own_address
                      && output.datum.switch {
                          i: Inline => Datum::from_data(i.data) == datum,
                          else => error("Invalid project UTxO: missing inline datum")
                        }
                      && output.value.to_map().all(
                          (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> Bool {
                            if (mph == ADA_MINTING_POLICY_HASH) {
                              tokens.get(ADA_TOKEN_NAME) >= min_producing_project_ada
                            } else if (mph == PROJECT_AT_MPH) {
                              tokens == Map[ByteArray]Int {PROJECT_AT_TOKEN_NAME: 1}
                            } else {
                              false
                            }
                          }
                        )
                  }
                ),
                "Invalid producing project output"
              );

              project_script_value: Value =
                Value::from_map(
                  Map[MintingPolicyHash]Map[ByteArray]Int {
                    ADA_MINTING_POLICY_HASH: Map[ByteArray]Int { ADA_TOKEN_NAME: PROJECT_SCRIPT_UTXO_ADA },
                    PROJECT_AT_MPH: Map[ByteArray]Int { PROJECT_SCRIPT_AT_TOKEN_NAME: 1 }
                  }
                );

              project_script_address: Address =
                Address::new(
                  Credential::new_validator(
                    pparams_datum.registry.project_script_validator.latest
                  ),
                  Option[StakingCredential]::Some { new_staking_credential }
              );

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == project_script_address
                      && output.value == project_script_value
                      && output.datum.switch {
                          i: Inline => {
                            project_script_datum: ProjectScriptDatum = ProjectScriptDatum::from_data(i.data);

                            project_script_datum.project_id == datum.project_id
                              && project_script_datum.stake_key_deposit == pparams_datum.stake_key_deposit
                          },
                          else => false
                        }
                      && StakingValidatorHash::from_script_hash(output.ref_script_hash.unwrap())
                        == allocate.new_staking_validator
                  }
                ),
                "Invalid producing project script output"
              );

              tx.dcerts.any(
                (dcert: DCert) -> {
                  dcert.switch {
                    register: Register => register.credential == new_staking_credential,
                    else => false
                  }
                }
              )
            },

            UpdateStakingDelegationManagement => {
              project_status: ProjectStatus = datum.status;

              assert(
                project_status.switch {
                  Active => true,
                  else => false
                },
                "Wrong project status"
              );

              assert(
                datum.is_staking_delegation_managed_by_protocol,
                "Staking delegation is not managed by protocol"
              );

              owner_address: Address = datum.owner_address;

              own_address: Address = own_spending_output.address;
              own_value: Value = own_spending_output.value;

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == own_address
                      && output.value == own_value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.project_id == datum.project_id
                            && output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.owner_address == owner_address
                            && output_datum.status == project_status
                            && output_datum.is_staking_delegation_managed_by_protocol == false
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid producing project output"
              );

              is_tx_authorized_by(tx, owner_address.credential)
            },

            InitiateClose => {
              assert(
                datum.status.switch {
                  Active => true,
                  else => false
                },
                "Wrong project status"
              );

              owner_address: Address = datum.owner_address;

              own_address: Address = own_spending_output.address;
              own_value: Value = own_spending_output.value;

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == own_address
                      && output.value == own_value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.project_id == datum.project_id
                            && output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.owner_address == owner_address
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                            && output_datum.status.switch {
                                pre_closed: PreClosed => pre_closed.pending_until >= tx.time_range.end,
                                else => false
                              }
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid producing project output"
              );

              is_tx_authorized_by(tx, owner_address.credential)
            },

            InitiateDelist => {
              assert(
                datum.status.switch {
                  Active => true,
                  PreClosed => true,
                  PreDelisted => true,
                  else => false
                },
                "Wrong project status"
              );

              own_address: Address = own_spending_output.address;
              own_value: Value = own_spending_output.value;

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == own_address
                      && output.value == own_value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.project_id == datum.project_id
                            && output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.owner_address == datum.owner_address
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                            && output_datum.status.switch {
                                pre_delisted: PreDelisted => {
                                  pre_delisted.pending_until
                                    == tx.time_range.end + pparams_datum.project_delist_waiting_period
                                },
                                else => false
                              }
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid producing project output"
              );

              is_tx_authorized_by(tx, pparams_datum.governor_address.credential)
            },

            CancelDelist => {
              assert(
                datum.status.switch {
                  PreDelisted => true,
                  else => false
                },
                "Wrong project status"
              );

              own_address: Address = own_spending_output.address;
              own_value: Value = own_spending_output.value;

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == own_address
                      && output.value == own_value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.project_id == datum.project_id
                            && output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.owner_address == datum.owner_address
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                            && output_datum.status.switch {
                                Active => true,
                                else => false
                              }
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid producing project output"
              );

              is_tx_authorized_by(tx, pparams_datum.governor_address.credential)
            },

            FinalizeClose => {
              project_id: ByteArray = datum.project_id;

              tx_time_start: Time = tx.time_range.start;

              project_detail_output_id: TxOutputId =
                tx.inputs
                  .find(
                    (input: TxInput) -> {
                      output: TxOutput = input.output;
                      output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                        && output.datum.switch {
                            i: Inline =>
                              ProjectDetailDatum::from_data(i.data).project_id == project_id,
                            else => false
                          }
                    }
                  )
                  .output_id;

              project_detail_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_detail_output_id);

              project_detail_redeemer: Data =
                tx.redeemers.get(project_detail_purpose);

              assert(
                ProjectDetailRedeemer::from_data(project_detail_redeemer).switch {
                  Close => true,
                  else => false
                },
                "Wrong Project detail redeemer"
              );

              expected_producing_address: Address =
                Address::new(
                  Credential::new_validator(own_validator_hash),
                  Option[StakingCredential]::Some{
                    script_hash_to_staking_credential(
                      pparams_datum.registry.protocol_staking_validator
                    )
                  }
                );

              expected_producing_value: Value =
                Value::from_map(
                  Map[MintingPolicyHash]Map[ByteArray]Int {
                    ADA_MINTING_POLICY_HASH: Map[ByteArray]Int { ADA_TOKEN_NAME: INACTIVE_PROJECT_UTXO_ADA },
                    PROJECT_AT_MPH: Map[ByteArray]Int { PROJECT_AT_TOKEN_NAME: 1 }
                  }
                );

              owner_address: Address = datum.owner_address;

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == expected_producing_address
                      && output.value == expected_producing_value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.project_id == project_id
                            && output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.owner_address == owner_address
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                            && output_datum.status.switch {
                                closed: Closed => closed.closed_at == tx_time_start,
                                else => false
                              }
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid producing project output"
              );

              if (is_tx_authorized_by(tx, owner_address.credential)) {
                datum.status.switch {
                  Active =>
                    tx_time_start >= tx.time_range.end - PROJECT_IMMEDIATE_CLOSURE_TX_TIME_SLIPPAGE,
                  pre_closed: PreClosed =>
                    tx_time_start >= pre_closed.pending_until,
                  else => false
                }
              } else {
                assert(
                  datum.status.switch {
                    pre_closed: PreClosed =>
                      tx_time_start >= pre_closed.pending_until,
                    else => false
                  },
                  "Wrong project status & time"
                );

                ada_to_owner: Int =
                  own_spending_output.value.get_safe(AssetClass::ADA)
                    - INACTIVE_PROJECT_UTXO_ADA
                    - (pparams_datum.discount_cent_price * PROJECT_CLOSE_DISCOUNT_CENTS / RATIO_MULTIPLIER);

                if (ada_to_owner > 0) {
                  tx.outputs.any(
                    (output: TxOutput) -> {
                      output.address == owner_address
                        && output.value.to_map().length == 1
                        && output.value.get(AssetClass::ADA) >= ada_to_owner
                        && output.datum.switch {
                          i: Inline =>
                            UserTag::from_data(i.data).switch {
                              tag: TagProjectClosed =>
                                tag.project_id == project_id,
                              else => false
                            },
                          else => false
                        }
                    }
                  )
                } else {
                  true
                }
              }

            },

            FinalizeDelist => {
              project_id: ByteArray = datum.project_id;

              tx_time_start: Time = tx.time_range.start;

              assert(
                datum.status.switch {
                  pre_delisted: PreDelisted =>
                    tx_time_start >= pre_delisted.pending_until,
                  else => false
                },
                "Wrong project status & time"
              );

              project_detail_output_id: TxOutputId =
                tx.inputs
                  .find(
                    (input: TxInput) -> {
                      output: TxOutput = input.output;
                      output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                        && output.datum.switch {
                            i: Inline =>
                              ProjectDetailDatum::from_data(i.data).project_id == project_id,
                            else => false
                          }
                    }
                  )
                  .output_id;

              project_detail_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_detail_output_id);

              project_detail_redeemer: Data =
                tx.redeemers.get(project_detail_purpose);

              assert(
                ProjectDetailRedeemer::from_data(project_detail_redeemer).switch {
                  Delist => true,
                  else => false
                },
                "Wrong Project detail redeemer"
              );

              expected_producing_address: Address =
                Address::new(
                  Credential::new_validator(own_validator_hash),
                  Option[StakingCredential]::Some{
                    script_hash_to_staking_credential(
                      pparams_datum.registry.protocol_staking_validator
                    )
                  }
                );

              expected_producing_value: Value =
                Value::from_map(
                  Map[MintingPolicyHash]Map[ByteArray]Int {
                    ADA_MINTING_POLICY_HASH: Map[ByteArray]Int { ADA_TOKEN_NAME: INACTIVE_PROJECT_UTXO_ADA },
                    PROJECT_AT_MPH: Map[ByteArray]Int { PROJECT_AT_TOKEN_NAME: 1 }
                  }
                );

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == expected_producing_address
                      && output.value == expected_producing_value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.project_id == project_id
                            && output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.owner_address == datum.owner_address
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                            && output_datum.status.switch {
                                delisted: Delisted => delisted.delisted_at == tx_time_start,
                                else => false
                              }
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid producing project output"
              );

              ada_to_treasury: Int =
                own_spending_output.value.get_safe(AssetClass::ADA)
                  - INACTIVE_PROJECT_UTXO_ADA
                  - (pparams_datum.discount_cent_price * PROJECT_DELIST_DISCOUNT_CENTS);

              if (ada_to_treasury > 0) {
                treasury_address: Address =
                  Address::new(
                    Credential::new_validator(
                      pparams_datum.registry.open_treasury_validator.latest
                    ),
                    Option[StakingCredential]::Some {
                      script_hash_to_staking_credential(
                        pparams_datum.registry.protocol_staking_validator
                      )
                    }
                  );

                tx.outputs.any(
                  (output: TxOutput) -> {
                    if (
                      output.address == treasury_address
                        && output.value.to_map().length == 1
                    ) {
                      treasury_ada: Int = output.value.get(AssetClass::ADA);
                      treasury_ada >= ada_to_treasury
                        && output.datum.switch {
                          i: Inline => {
                            open_treasury_datum: OpenTreasuryDatum = OpenTreasuryDatum::from_data(i.data);
                            open_treasury_datum.tag.switch {
                              tag_delisted: TagProjectDelisted =>
                                tag_delisted.project_id == project_id,
                              else => false
                            }
                              && open_treasury_datum.governor_ada
                                == treasury_ada * pparams_datum.governor_share_ratio / RATIO_MULTIPLIER
                          },
                          else => false
                        }
                    } else {
                      false
                    }
                  }
                )
              } else {
                true
              }
            },

            else => false

          }
        }
      }
    }
  `;
}
