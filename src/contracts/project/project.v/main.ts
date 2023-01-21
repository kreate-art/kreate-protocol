import { Hex } from "@/types";

import { helios } from "../../program";

export type Params = {
  projectAtMph: Hex;
  protocolNftMph: Hex;
};

export default function main({ projectAtMph, protocolNftMph }: Params) {
  return helios("v__project", [
    "v__project__types",
    "constants",
    "v__project_script__types",
    "v__protocol_params__types",
    "v__project_detail__types",
    "v__open_treasury__types",
    "common__types",
    "helpers",
    "constants",
  ])`
    spending  v__project

    import { Redeemer, Datum, ProjectStatus } from v__project__types
    import {
      PROJECT_SCRIPT_UTXO_ADA
    } from constants
    import { Datum as ProjectScriptDatum } from v__project_script__types
    import { Datum as PParamsDatum } from v__protocol_params__types
    import {
      Datum as ProjectDetailDatum,
      Redeemer as ProjectDetailRedeemer
    } from v__project_detail__types
    import { Datum as OpenTreasuryDatum } from v__open_treasury__types
    import { UserTag } from common__types

    import {
      find_pparams_datum_from_inputs,
      is_tx_authorized_by,
      scriptHashToStakingCredential
    } from helpers

    import {
      INACTIVE_PROJECT_UTXO_ADA,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_CLOSE_DISCOUNT_CENTS,
      PROJECT_DELIST_DISCOUNT_CENTS,
      PROJECT_DETAIL_AT_TOKEN_NAME,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      MULTIPLIER
    } from constants

    const PROJECTS_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectAtMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_DETAIL_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_DETAIL_AT_TOKEN_NAME)

    const PROJECT_SCRIPT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_SCRIPT_AT_TOKEN_NAME)

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
          own_output_txout: TxOutput =
            tx.outputs_locked_by(ctx.get_current_validator_hash())
              .head;

          own_output_datum: Datum =
            own_output_txout.datum
              .switch {
                i:Inline => Datum::from_data(i.data),
                else => error("Invalid project UTxO: missing inline datum")
              };

          assert (
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

              project_detail_script_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_detail_txinput.output_id);

              project_detail_redeemer_data: Data =
                tx.redeemers.get(project_detail_script_purpose);

              assert (
                  record.new_milestone > datum.milestone_reached,
                  "Invalid new milestone"
              );

              assert (
                ProjectDetailRedeemer::from_data(project_detail_redeemer_data).switch {
                  WithdrawFunds => true,
                  else => false
                },
                "Wrong Project detail redeemer"
              );

              own_output_txout.address == own_input_txout.address
                && own_output_txout.value == own_input_txout.value
                && own_output_datum.milestone_reached == record.new_milestone
                && own_output_datum.project_id == datum.project_id
                && own_output_datum.owner_address == datum.owner_address
                && own_output_datum.status == datum.status
                && own_output_datum.is_staking_delegation_managed_by_protocol
                    == datum.is_staking_delegation_managed_by_protocol

            },
            allocate: AllocateStakingValidator => {
              new_staking_credential: StakingCredential =
                StakingCredential::new_hash(StakingHash::new_validator(allocate.new_staking_validator));

              assert (
                is_tx_authorized_by(tx, datum.owner_address.credential)
                  || is_tx_authorized_by(tx, pparams_datum.staking_manager)
                  || is_tx_authorized_by(tx, pparams_datum.governor_address.credential),
                "Transaction is not authorized"
              );

              assert (
                datum.status.switch {
                  Active => true,
                  else => false
                },
                "Wrong project status"
              );

              assert (
                tx.outputs
                  .any(
                    (output: TxOutput) -> Bool {
                      output.address == Address::new(
                        Credential::new_validator(
                          pparams_datum.registry
                            .project_script_validator
                            .latest
                        ),
                        Option[StakingCredential]::Some{new_staking_credential}
                      )
                        && output.value.to_map().length == 2
                        && output.value.get_safe(AssetClass::ADA) == PROJECT_SCRIPT_UTXO_ADA
                        && output.value.get_safe(PROJECT_SCRIPT_AT_ASSET_CLASS) == 1
                        && output.datum.switch{
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
                "Invalid project script UTxO"
                );

              assert (
                own_output_txout.address == own_input_txout.address
                  && own_output_txout.value.to_map().length == 2
                  && own_output_txout.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                  && own_output_txout.value.get_safe(AssetClass::ADA)
                      >= own_input_txout.value.get_safe(AssetClass::ADA)
                          - pparams_datum.stake_key_deposit
                          - PROJECT_SCRIPT_UTXO_ADA
                  && own_output_datum == datum,
                "Invalid own output UTxO"
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
              assert (
                datum.status.switch {
                  Active => true,
                  else => false
                },
                "Wrong project status"
              );

              assert (
                datum.is_staking_delegation_managed_by_protocol,
                "Staking delegation is not managed by protocol"
              );

              assert (
                own_output_txout.value == own_input_txout.value
                  && own_output_txout.address == own_input_txout.address
                  && own_output_datum.milestone_reached == datum.milestone_reached
                  && own_output_datum.project_id == datum.project_id
                  && own_output_datum.owner_address == datum.owner_address
                  && own_output_datum.status == datum.status
                  && own_output_datum.is_staking_delegation_managed_by_protocol == false,
                "Invalid own output UTxO"
              );

              is_tx_authorized_by(tx, datum.owner_address.credential)

            },
            InitiateClose => {
              assert (
                datum.status.switch {
                  Active => true,
                  else => false
                },
                "Wrong project status"
              );

              assert (
                own_output_txout.value == own_input_txout.value
                  && own_output_txout.address == own_input_txout.address
                  && own_output_datum.milestone_reached == datum.milestone_reached
                  && own_output_datum.project_id == datum.project_id
                  && own_output_datum.owner_address == datum.owner_address
                  && own_output_datum.status.switch {
                      pre_closed: PreClosed => pre_closed.pending_until >= tx.time_range.end,
                      else => false
                    }
                  && own_output_datum.is_staking_delegation_managed_by_protocol
                      == datum.is_staking_delegation_managed_by_protocol,
                "Invalid own output UTxO"
              );

              is_tx_authorized_by(tx, datum.owner_address.credential)

            },
            InitiateDelist => {
              assert (
                datum.status.switch {
                  Active => true,
                  PreClosed => true,
                  PreDelisted => true,
                  else => false
                },
                "Invalid project status"
              );

              assert (
                own_output_txout.value == own_input_txout.value
                  && own_output_txout.address == own_input_txout.address
                  && own_output_datum.milestone_reached == datum.milestone_reached
                  && own_output_datum.project_id == datum.project_id
                  && own_output_datum.owner_address == datum.owner_address
                  && own_output_datum.status.switch {
                      pre_delisted: PreDelisted => {
                        pre_delisted.pending_until
                          == tx.time_range.end + pparams_datum.project_delist_waiting_period
                      },
                      else => false
                    }
                  && own_output_datum.is_staking_delegation_managed_by_protocol
                      == datum.is_staking_delegation_managed_by_protocol,
                "Invalid own output UTxO"
              );

              is_tx_authorized_by(tx, pparams_datum.governor_address.credential)

            },
            CancelDelist => {
              assert (
                datum.status.switch {
                  PreDelisted => true,
                  else => false
                },
                "Invalid project status"
              );

              assert (
                own_output_txout.value == own_input_txout.value
                  && own_output_txout.address == own_input_txout.address
                  && own_output_datum.milestone_reached == datum.milestone_reached
                  && own_output_datum.project_id == datum.project_id
                  && own_output_datum.owner_address == datum.owner_address
                  && own_output_datum.status.switch {
                      Active => true,
                      else => false
                    }
                  && own_output_datum.is_staking_delegation_managed_by_protocol
                      == datum.is_staking_delegation_managed_by_protocol,
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

              project_detail_script_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_detail_txinput.output_id);

              project_detail_redeemer_data: Data =
                tx.redeemers.get(project_detail_script_purpose);

              assert (
                ProjectDetailRedeemer::from_data(project_detail_redeemer_data).switch {
                  Close => true,
                  else => false
                },
                "Missing input Project detail UTxO"
              );

              assert (
                own_output_txout.address == Address::new(
                  own_input_txout.address.credential,
                  Option[StakingCredential]::Some{
                    scriptHashToStakingCredential(
                      pparams_datum.registry.protocol_staking_validator
                    )
                  }
                )
                  && own_output_txout.value == Value::lovelace(INACTIVE_PROJECT_UTXO_ADA)
                  && own_output_datum.milestone_reached == datum.milestone_reached
                  && own_output_datum.project_id == datum.project_id
                  && own_output_datum.owner_address == datum.owner_address
                  && own_output_datum.status.switch {
                      Closed => true,
                      else => false
                    }
                  && own_output_datum.is_staking_delegation_managed_by_protocol
                      == datum.is_staking_delegation_managed_by_protocol,
                "Invalid own output UTxO"
              );

              if (is_tx_authorized_by(tx, datum.owner_address.credential)){
                datum.status.switch {
                  Active => true,
                  pre_closed: PreClosed => pre_closed.pending_until < tx.time_range.start,
                  else => false
                }
              } else {
                is_status_valid: Bool =
                  datum.status.switch {
                    pre_closed: PreClosed => pre_closed.pending_until < tx.time_range.start,
                    else => false
                  };

                ada_to_owner: Int =
                  own_input_txout.value.get_safe(AssetClass::ADA)
                    - INACTIVE_PROJECT_UTXO_ADA
                    - pparams_datum.discount_cent_price * PROJECT_CLOSE_DISCOUNT_CENTS / MULTIPLIER;

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

              project_detail_script_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_detail_txinput.output_id);

              project_detail_redeemer_data: Data =
                tx.redeemers.get(project_detail_script_purpose);

              ada_to_treasury: Int =
                own_input_txout.value.get_safe(AssetClass::ADA)
                  - INACTIVE_PROJECT_UTXO_ADA
                  - (pparams_datum.discount_cent_price * PROJECT_DELIST_DISCOUNT_CENTS);

              assert (
                datum.status.switch {
                  pre_delisted: PreDelisted => pre_delisted.pending_until < tx.time_range.start,
                  else => false
                },
                "Invalid project status"
              );

              assert (
                ProjectDetailRedeemer::from_data(project_detail_redeemer_data).switch {
                  Delist => true,
                  else => false
                },
                "Wrong consumed Project detail redeemer"
              );

              assert (
                own_output_txout.address == Address::new(
                  own_input_txout.address.credential,
                  Option[StakingCredential]::Some{
                    scriptHashToStakingCredential(
                      pparams_datum.registry.protocol_staking_validator
                    )
                  }
                )
                  && own_output_txout.value == Value::lovelace(INACTIVE_PROJECT_UTXO_ADA)
                  && own_output_datum.milestone_reached == datum.milestone_reached
                  && own_output_datum.project_id == datum.project_id
                  && own_output_datum.owner_address == datum.owner_address
                  && own_output_datum.status.switch {
                      Delisted => true,
                      else => false
                    }
                  && own_output_datum.is_staking_delegation_managed_by_protocol
                      == datum.is_staking_delegation_managed_by_protocol,
                "Invalid own output UTxO"
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
                        scriptHashToStakingCredential(
                          pparams_datum.registry.protocol_staking_validator
                        )
                      }
                    )
                      && treasury_ada >= ada_to_treasury
                      && output.datum.switch {
                        i: Inline => {
                          open_treasury_datum: OpenTreasuryDatum = OpenTreasuryDatum::from_data(i.data);

                          open_treasury_datum.governor_ada == treasury_ada * pparams_datum.governor_share_ratio / MULTIPLIER
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
