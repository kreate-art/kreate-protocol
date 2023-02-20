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

      own_input_txout: TxOutput = ctx.get_current_input().output;

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
              project_detail_txinput: TxInput =
                tx.inputs
                  .find(
                    (input: TxInput) -> Bool {
                      input.output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                        && input.output.datum.switch {
                            i: Inline => ProjectDetailDatum::from_data(i.data).project_id == datum.project_id,
                            else => false
                          }
                    }
                  );

              project_detail_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_detail_txinput.output_id);

              project_detail_redeemer: Data =
                tx.redeemers.get(project_detail_purpose);

              assert(
                  record.new_milestone > datum.milestone_reached,
                  "Invalid new milestone"
              );

              assert(
                ProjectDetailRedeemer::from_data(project_detail_redeemer).switch {
                  WithdrawFunds => true,
                  else => false
                },
                "Wrong Project detail redeemer"
              );

              tx.outputs.any(
                (output: TxOutput) -> Bool {
                  output.address == own_input_txout.address
                    && output.value == own_input_txout.value
                    && output.datum.switch {
                      i: Inline => {
                        output_datum: Datum = Datum::from_data(i.data);

                        output_datum.milestone_reached == record.new_milestone
                          && output_datum.project_id == datum.project_id
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
                StakingCredential::new_hash(StakingHash::new_validator(allocate.new_staking_validator));

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

              is_own_output_valid: Bool =
                tx.outputs.any(
                  (output: TxOutput) -> Bool {
                    output.address == own_input_txout.address
                      && output.datum.switch {
                        i: Inline => Datum::from_data(i.data) == datum,
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                      && output.value.to_map().all(
                        (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> Bool {
                          if (mph == ADA_MINTING_POLICY_HASH) {
                            output.value.get_safe(AssetClass::ADA)
                              >= own_input_txout.value.get_safe(AssetClass::ADA)
                                  - pparams_datum.stake_key_deposit
                                  - PROJECT_SCRIPT_UTXO_ADA
                          }
                          else if (mph == PROJECT_AT_MPH) { tokens == Map[ByteArray]Int {PROJECT_AT_TOKEN_NAME: 1} }
                          else { false }
                        }
                      )
                  }
                );

              assert(
                is_own_output_valid,
                "Invalid own output"
              );

              output_project_script: TxOutput =
                tx.outputs.find_safe(
                  (output: TxOutput) -> Bool {
                    output.value.to_map().all(
                      (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> Bool {
                        if (mph == ADA_MINTING_POLICY_HASH) {
                          output.value.get_safe(AssetClass::ADA)
                            == PROJECT_SCRIPT_UTXO_ADA
                        } else if (mph == PROJECT_AT_MPH) {
                          tokens == Map[ByteArray]Int {PROJECT_SCRIPT_AT_TOKEN_NAME: 1}
                        } else { false }
                      }
                    )
                  }
                )
                .switch {
                  None => error("Missing output project script"),
                  s: Some => s.some
                };

              assert(
                output_project_script.address == Address::new(
                  Credential::new_validator(
                    pparams_datum.registry
                      .project_script_validator
                      .latest
                  ),
                  Option[StakingCredential]::Some{new_staking_credential}
                ),
                "Invalid output project script address"
              );

              assert(
                output_project_script.datum.switch {
                  i: Inline => {
                    project_script_datum: ProjectScriptDatum = ProjectScriptDatum::from_data(i.data);

                    project_script_datum.project_id == datum.project_id
                      && project_script_datum.stake_key_deposit == pparams_datum.stake_key_deposit
                  },
                  else => false
                },
                "Invalid output project script datum"
              );

              assert(
                StakingValidatorHash::from_script_hash(output_project_script.ref_script_hash.unwrap())
                  == allocate.new_staking_validator,
                "Invalid output project script ref script hash"
              );



              tx.dcerts
                .any (
                  (dcert: DCert) -> Bool {
                    dcert.switch {
                      register: Register => register.credential == new_staking_credential,
                      else => false
                    }
                  }
                )

            },
            UpdateStakingDelegationManagement => {
              assert(
                datum.status.switch {
                  Active => true,
                  else => false
                },
                "Wrong project status"
              );

              assert(
                datum.is_staking_delegation_managed_by_protocol,
                "Staking delegation is not managed by protocol"
              );



              assert(
                tx.outputs.any(
                  (output: TxOutput) -> Bool {
                    output.address == own_input_txout.address
                      && output.value == own_input_txout.value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.project_id == datum.project_id
                            && output_datum.owner_address == datum.owner_address
                            && output_datum.status == datum.status
                            && output_datum.is_staking_delegation_managed_by_protocol == false
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid own output UTxO"
              );

              is_tx_authorized_by(tx, datum.owner_address.credential)

            },
            InitiateClose => {
              assert(
                datum.status.switch {
                  Active => true,
                  else => false
                },
                "Wrong project status"
              );

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> Bool {
                    output.address == own_input_txout.address
                      && output.value == own_input_txout.value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.project_id == datum.project_id
                            && output_datum.owner_address == datum.owner_address
                            && output_datum.status.switch {
                                pre_closed: PreClosed => pre_closed.pending_until >= tx.time_range.end,
                                else => false
                              }
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid own output UTxO"
              );

              is_tx_authorized_by(tx, datum.owner_address.credential)

            },
            InitiateDelist => {
              assert(
                datum.status.switch {
                  Active => true,
                  PreClosed => true,
                  PreDelisted => true,
                  else => false
                },
                "Invalid project status"
              );

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> Bool {
                    output.address == own_input_txout.address
                      && output.value == own_input_txout.value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.project_id == datum.project_id
                            && output_datum.owner_address == datum.owner_address
                            && output_datum.status.switch {
                                pre_delisted: PreDelisted => {
                                  pre_delisted.pending_until
                                    == tx.time_range.end + pparams_datum.project_delist_waiting_period
                                },
                                else => false
                              }
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid own output UTxO"
              );

              is_tx_authorized_by(tx, pparams_datum.governor_address.credential)

            },
            CancelDelist => {
              assert(
                datum.status.switch {
                  PreDelisted => true,
                  else => false
                },
                "Invalid project status"
              );

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> Bool {
                    output.address == own_input_txout.address
                      && output.value == own_input_txout.value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.project_id == datum.project_id
                            && output_datum.owner_address == datum.owner_address
                            && output_datum.status.switch {
                                Active => true,
                                else => false
                              }
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid own output UTxO"
              );

              is_tx_authorized_by(tx, pparams_datum.governor_address.credential)

            },
            FinalizeClose => {
              project_detail_txinput: TxInput =
                tx.inputs
                  .find(
                    (input: TxInput) -> Bool {
                      input.output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                        && input.output.datum.switch {
                            i: Inline => ProjectDetailDatum::from_data(i.data).project_id == datum.project_id,
                            else => false
                          }
                    }
                  );

              project_detail_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_detail_txinput.output_id);

              project_detail_redeemer: Data =
                tx.redeemers.get(project_detail_purpose);

              assert(
                ProjectDetailRedeemer::from_data(project_detail_redeemer).switch {
                  Close => true,
                  else => false
                },
                "Missing input Project detail UTxO"
              );

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> Bool {
                    output.address == Address::new(
                        own_input_txout.address.credential,
                        Option[StakingCredential]::Some{
                          script_hash_to_staking_credential(
                            pparams_datum.registry.protocol_staking_validator
                          )
                        }
                      )
                      && output.value.to_map().all(
                        (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> Bool {
                          if (mph == ADA_MINTING_POLICY_HASH) {
                            tokens == Map[ByteArray]Int{ADA_TOKEN_NAME: INACTIVE_PROJECT_UTXO_ADA}
                          } else {
                            tokens == own_input_txout.value.to_map().get(mph)
                          }
                        }
                      )
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.project_id == datum.project_id
                            && output_datum.owner_address == datum.owner_address
                            && output_datum.status.switch {
                                closed: Closed => closed.closed_at == tx.time_range.start,
                                else => false
                              }
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid output txout"
              );

              if (is_tx_authorized_by(tx, datum.owner_address.credential)){
                datum.status.switch {
                  Active =>
                    tx.time_range.start >= tx.time_range.end - PROJECT_IMMEDIATE_CLOSURE_TX_TIME_SLIPPAGE,
                  pre_closed: PreClosed => pre_closed.pending_until < tx.time_range.start,
                  else => false
                }
              } else {
                is_status_valid: Bool =
                  datum.status.switch {
                    pre_closed: PreClosed => pre_closed.pending_until <= tx.time_range.start,
                    else => false
                  };

                ada_to_owner: Int =
                  own_input_txout.value.get_safe(AssetClass::ADA)
                    - INACTIVE_PROJECT_UTXO_ADA
                    - pparams_datum.discount_cent_price * PROJECT_CLOSE_DISCOUNT_CENTS / RATIO_MULTIPLIER;

                is_status_valid
                  && if (ada_to_owner > 0) {
                        tx.outputs.any(
                          (output: TxOutput) -> Bool {
                            output.address == datum.owner_address
                              && output.value >= Value::lovelace(ada_to_owner)
                              && output.datum.switch {
                                i: Inline =>
                                  UserTag::from_data(i.data).switch {
                                    tag: TagProjectClosed =>
                                      tag.project_id == datum.project_id,
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
              project_detail_txinput: TxInput =
                tx.inputs
                  .find(
                    (input: TxInput) -> Bool {
                      input.output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                        && input.output.datum.switch {
                            i: Inline => ProjectDetailDatum::from_data(i.data).project_id == datum.project_id,
                            else => false
                          }
                    }
                  );

              project_detail_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_detail_txinput.output_id);

              project_detail_redeemer: Data =
                tx.redeemers.get(project_detail_purpose);

              ada_to_treasury: Int =
                own_input_txout.value.get_safe(AssetClass::ADA)
                  - INACTIVE_PROJECT_UTXO_ADA
                  - (pparams_datum.discount_cent_price * PROJECT_DELIST_DISCOUNT_CENTS);

              assert(
                datum.status.switch {
                  pre_delisted: PreDelisted => pre_delisted.pending_until < tx.time_range.start,
                  else => false
                },
                "Invalid project status"
              );

              assert(
                ProjectDetailRedeemer::from_data(project_detail_redeemer).switch {
                  Delist => true,
                  else => false
                },
                "Wrong consumed Project detail redeemer"
              );

              assert(
                tx.outputs.any(
                  (output: TxOutput) -> Bool {
                    output.address == Address::new(
                        own_input_txout.address.credential,
                        Option[StakingCredential]::Some{
                          script_hash_to_staking_credential(
                            pparams_datum.registry.protocol_staking_validator
                          )
                        }
                      )
                      && output.value.to_map().all(
                        (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> Bool {
                          if (mph == ADA_MINTING_POLICY_HASH) {
                            tokens == Map[ByteArray]Int{ADA_TOKEN_NAME: INACTIVE_PROJECT_UTXO_ADA}
                          } else {
                            tokens == own_input_txout.value.to_map().get(mph)
                          }
                        }
                      )
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.milestone_reached == datum.milestone_reached
                            && output_datum.project_id == datum.project_id
                            && output_datum.owner_address == datum.owner_address
                            && output_datum.status.switch {
                                delisted: Delisted => delisted.delisted_at == tx.time_range.start,
                                else => false
                              }
                            && output_datum.is_staking_delegation_managed_by_protocol
                                == datum.is_staking_delegation_managed_by_protocol
                        },
                        else => error("Invalid project UTxO: missing inline datum")
                      }
                  }
                ),
                "Invalid output txout"
              );

              if (ada_to_treasury > 0){
                tx.outputs.any(
                  (output: TxOutput) -> Bool {
                    treasury_ada: Int = output.value.get_safe(AssetClass::ADA);

                    output.address == Address::new(
                      Credential::new_validator(
                        pparams_datum.registry
                          .open_treasury_validator
                          .latest
                      ),
                      Option[StakingCredential]::Some{
                        script_hash_to_staking_credential(
                          pparams_datum.registry.protocol_staking_validator
                        )
                      }
                    )
                      && treasury_ada >= ada_to_treasury
                      && output.datum.switch {
                        i: Inline => {
                          open_treasury_datum: OpenTreasuryDatum = OpenTreasuryDatum::from_data(i.data);

                          open_treasury_datum.governor_ada == treasury_ada * pparams_datum.governor_share_ratio / RATIO_MULTIPLIER
                            && open_treasury_datum.tag.switch {
                              tag_delisted: TagProjectDelisted => tag_delisted.project_id == datum.project_id,
                              else => false
                            }
                        },
                        else => false
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
