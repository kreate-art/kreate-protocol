import { helios } from "../../program";

export type ProjectDetailParams = {
  projectsAuthTokenMph: string;
  protocolNftMph: string;
};

export default function main({
  projectsAuthTokenMph,
  protocolNftMph,
}: ProjectDetailParams) {
  return helios`
    spending v__project_detail

    import { Datum, Redeemer } from v__project_detail__types
    import { UserTag } from common__types
    import {
      ProjectStatus,
      Redeemer as ProjectRedeemer,
      Datum as ProjectDatum
    } from v__project__types
    import { Datum as ProjectScriptDatum } from v__project_script__types
    import { Datum as PParamsDatum } from v__protocol_params__types
    import {
      Datum as DedicatedTreasuryDatum,
      Redeemer as DedicatedTreasuryRedeemer
    } from v__dedicated_treasury__types

    import {
      find_pparams_datum_from_inputs,
      is_tx_authorized_by,
      scriptHashToStakingCredential
    } from helpers

    import {
      MULTIPLIER,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO,
      PROJECT_NEW_MILESTONE_DISCOUNT_CENTS,
      PROJECT_MIN_FUNDS_WITHDRAWAL_ADA,
      PROJECT_SCRIPT_AT_TOKEN_NAME
    } from constants

    const PROJECTS_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectsAuthTokenMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_SCRIPT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_SCRIPT_AT_TOKEN_NAME)

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func get_project_txinput(inputs: []TxInput) -> TxInput {
      inputs.find(
        (input: TxInput) -> Bool {
          input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
        }
      )
    }

    func get_project_datum(output: TxOutput) -> ProjectDatum {
      output.datum.switch {
        i: Inline => ProjectDatum::from_data(i.data),
        else => error("Invalid Project utxo: missing inline datum")
      }
    }

    func get_project_datum_with_project_id (
      output: TxOutput,
      project_id: ByteArray
    ) -> ProjectDatum {
      project_datum: ProjectDatum = get_project_datum(output);

      if (project_datum.project_id == project_id) {
        project_datum
      } else {
        error("Wrong project_id")
      }
    }

    func assert_output_with_correct_project_id (
      output: TxOutput,
      project_id: ByteArray
    ) -> () {
      project_datum: ProjectDatum = get_project_datum(output);

      assert (
        project_datum.project_id == project_id,
        "Wrong project_id"
      )
    }

    func get_own_output_datum (output: TxOutput) -> Datum {
      output.datum.switch {
        i:Inline => Datum::from_data(i.data),
        else => error("Invalid project detail UTxO: missing inline datum")
      }
    }

    func check_latest_script_version (
      own_validator_hash: ValidatorHash,
      pparams_datum: PParamsDatum
    ) -> () {
      assert (
        own_validator_hash ==
          pparams_datum.registry.project_detail_validator.latest,
        "Wrong script version"
      )
    }

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      own_input_txout: TxOutput = ctx.get_current_input().output;

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      redeemer.switch {
        WithdrawFunds => {
          own_output_txout: TxOutput =
            tx.outputs_locked_by(ctx.get_current_validator_hash())
              .head;

          own_output_datum: Datum = get_own_output_datum(own_output_txout);

          project_txinput: TxInput = get_project_txinput(tx.ref_inputs + tx.inputs);

          project_datum: ProjectDatum =
            get_project_datum_with_project_id(project_txinput.output, datum.project_id);

          is_project_status_valid: Bool =
            project_datum.status.switch {
              Active => true,
              PreClosed => true,
              else => false
            };

          staking_credentials: []StakingCredential =
            tx.ref_inputs
              .filter(
                (input: TxInput) -> Bool {
                  input.output.value.get_safe(PROJECT_SCRIPT_AT_ASSET_CLASS) == 1
                    && input.output.datum.switch {
                      i: Inline =>
                        ProjectScriptDatum::from_data(i.data).project_id
                          == datum.project_id,
                      else => false
                    }
                }
              )
              .map(
                (input: TxInput) -> StakingCredential {
                  input.output.address.staking_credential.unwrap()
                }
              );

          total_withdrawal: Int =
            staking_credentials.fold (
              (acc: Int, staking_credential: StakingCredential) -> Int {
                acc + tx.withdrawals.get(staking_credential)
              },
              0
            );

          new_withdrawn_funds: Int = datum.withdrawn_funds + total_withdrawal;

          milestone: Int =
            pparams_datum.project_milestones.fold(
              (acc: Int, lovelace: Int) -> Int {
                if(new_withdrawn_funds > lovelace){
                  acc + 1
                } else {
                  acc
                }
              },
              0
            );

          is_new_milestone_reached: Bool = milestone > project_datum.milestone_reached;

          dedicated_treasury_input: TxInput =
            tx.inputs.find(
              (input: TxInput) -> Bool {
                dedicated_treasury_credential: Credential =
                  Credential::new_validator(
                    pparams_datum.registry
                      .dedicated_treasury_validator
                      .latest
                  );

                input_credential: Credential = input.output.address.credential;

                if (input_credential == dedicated_treasury_credential) {
                    input.output.datum.switch {
                      i: Inline =>
                        DedicatedTreasuryDatum::from_data(i.data).project_id
                          == datum.project_id,
                      else => false
                    }
                } else {
                  false
                }
              }
            );

          dedicated_treasury_script_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(dedicated_treasury_input.output_id);

          dedicated_treasury_redeemer_data: Data =
            tx.redeemers.get(dedicated_treasury_script_purpose);

          fees: Int =
            total_withdrawal * pparams_datum.protocol_funds_share_ratio / MULTIPLIER;

          does_consume_treasury_correctly: Bool =
            DedicatedTreasuryRedeemer::from_data(dedicated_treasury_redeemer_data).switch {
              collect_fees: CollectFees => {
                collect_fees.split == is_new_milestone_reached
                  && collect_fees.min_fees == fees
              },
              else => false
            };

          does_consume_project_utxo: Bool =
            if (is_new_milestone_reached) {
              project_script_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_txinput.output_id);

              project_redeemer_data: Data = tx.redeemers.get(project_script_purpose);

              ProjectRedeemer::from_data(project_redeemer_data).switch {
                record: RecordNewMilestone => record.new_milestone == milestone,
                else => false
              }
            } else {
              true
            };

          does_send_rewards_correctly: Bool =
            if (is_tx_authorized_by(tx, project_datum.owner_address.credential)) {
              discount: Int =
                total_withdrawal * PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO / MULTIPLIER
                + if (is_new_milestone_reached) {
                  pparams_datum.discount_cent_price * PROJECT_NEW_MILESTONE_DISCOUNT_CENTS
                } else {
                  if (total_withdrawal >= PROJECT_MIN_FUNDS_WITHDRAWAL_ADA) {
                    0
                  } else {
                    error("Withdrawal amount too small")
                  }
                }
                ;

              tx.outputs.any(
                (output: TxOutput) -> Bool {
                  output.address == project_datum.owner_address
                    && output.value.get(AssetClass::ADA)
                        >= (total_withdrawal - fees - discount)
                    && output.datum.switch {
                      i:Inline =>
                        UserTag::from_data(i.data).switch {
                          tag: TagProjectFundsWithdrawal =>
                            tag.project_id == datum.project_id,
                          else => false
                        },
                      else => false
                    }
                }
              )
            } else {
              true
            };

          is_own_output_valid: Bool =
            own_input_txout.value == own_output_txout.value
              && own_input_txout.address == own_output_txout.address
              && datum.project_id == own_output_datum.project_id
              && own_output_datum.withdrawn_funds == new_withdrawn_funds
              && datum.sponsored_until == own_output_datum.sponsored_until
              && datum.information_cid == own_output_datum.information_cid
              && datum.last_community_update_cid
                  == own_output_datum.last_community_update_cid;

          check_latest_script_version(own_validator_hash, pparams_datum);

          is_project_status_valid
            && does_consume_treasury_correctly
            && does_consume_project_utxo
            && does_send_rewards_correctly
            && is_own_output_valid
        },
        Update => {
          own_output_txout: TxOutput =
            tx.outputs_locked_by(ctx.get_current_validator_hash())
              .head;

          own_output_datum: Datum = get_own_output_datum(own_output_txout);

          project_txinput: TxInput = get_project_txinput(tx.ref_inputs + tx.inputs);

          project_datum: ProjectDatum =
            get_project_datum_with_project_id(project_txinput.output, datum.project_id);

          is_project_status_valid: Bool =
            project_datum.status.switch {
              Active => true,
              PreClosed => true,
              PreDelisted => true,
              else => false
            };

          is_output_datum_valid: Bool =
            own_input_txout.address == own_output_txout.address
              && own_input_txout.value == own_output_txout.value
              && datum.project_id == own_output_datum.project_id
              && datum.withdrawn_funds == own_output_datum.withdrawn_funds
              && (
                datum.sponsored_until != own_output_datum.sponsored_until
                  || datum.information_cid != own_output_datum.information_cid
                  || datum.last_community_update_cid
                      != own_output_datum.last_community_update_cid
              );

          update_sponsor_fee: Int =
            if (datum.sponsored_until != own_output_datum.sponsored_until){
              initial_sponsored: Time =
                datum.sponsored_until.switch {
                  None => tx.time_range.start,
                  else => {
                    input_sponsored_until: Time = datum.sponsored_until.unwrap();

                    if (input_sponsored_until > tx.time_range.start) {
                      input_sponsored_until
                    } else {
                      tx.time_range.start
                    }
                  }
                };

              is_output_sponsored_until_valid: Bool =
                own_output_datum.sponsored_until.unwrap() ==
                  initial_sponsored + pparams_datum.project_sponsorship_duration;

              if (is_output_sponsored_until_valid) {
                pparams_datum.project_sponsorship_fee
              } else {
                error("Invalid sponsored until")
              }
            } else {
              0
            };

          update_info_fee: Int =
            if (datum.information_cid != own_output_datum.information_cid) {
              if (own_output_datum.information_cid.encode_utf8().length > 0){
                pparams_datum.project_information_update_fee
              } else {
                error("Invalid information cid")
              }
            } else {
              0
            };

          update_community_fee: Int =
            if (datum.last_community_update_cid != own_output_datum.last_community_update_cid) {
              if (own_output_datum.last_community_update_cid.unwrap().encode_utf8().length > 0){
                pparams_datum.project_community_update_fee
              } else {
                error("Invalid community update cid")
              }
            } else {
              0
            };

          min_total_fees: Int = update_sponsor_fee + update_info_fee + update_community_fee;

          dedicated_treasury_credential: Credential =
            Credential::new_validator(
              pparams_datum.registry
                .dedicated_treasury_validator
                .latest
            );

          dedicated_treasury_input: TxInput =
            tx.inputs.find(
              (input: TxInput) -> Bool {
                input_credential: Credential = input.output.address.credential;

                if (input_credential == dedicated_treasury_credential) {
                    input.output.datum.switch {
                      i: Inline =>
                        DedicatedTreasuryDatum::from_data(i.data).project_id == datum.project_id,
                      else => false
                    }
                } else {
                  false
                }
              }
            );

          dedicated_treasury_script_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(dedicated_treasury_input.output_id);

          dedicated_treasury_redeemer_data: Data =
            tx.redeemers.get(dedicated_treasury_script_purpose);

          does_consume_treasury_correctly: Bool =
            DedicatedTreasuryRedeemer::from_data(dedicated_treasury_redeemer_data).switch {
              collect_fees: CollectFees => {
                collect_fees.split == false
                  && collect_fees.min_fees == min_total_fees
              },
              else => false
            };

          check_latest_script_version(own_validator_hash, pparams_datum);

          is_tx_authorized_by(tx, project_datum.owner_address.credential)
            && is_project_status_valid
            && own_input_txout.value == own_output_txout.value
            && own_input_txout.address == own_output_txout.address
            && is_output_datum_valid
            && does_consume_treasury_correctly
        },
        Close => {
          own_output_txout: TxOutput =
            tx.outputs_locked_by(ctx.get_current_validator_hash())
              .head;

          own_output_datum: Datum = get_own_output_datum(own_output_txout);

          project_txinput: TxInput = get_project_txinput(tx.ref_inputs + tx.inputs);

          is_producing_utxo_valid: Bool =
            own_output_txout.address == Address::new(
              own_input_txout.address.credential,
              Option[StakingCredential]::Some{
                scriptHashToStakingCredential(
                  pparams_datum.registry.protocol_staking_validator
                )
              }
            )
              && own_output_txout.value == own_input_txout.value
              && own_output_datum == datum;

          project_script_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(project_txinput.output_id);

          project_redeemer_data: Data = tx.redeemers.get(project_script_purpose);

          does_consume_project_correctly: Bool =
            ProjectRedeemer::from_data(project_redeemer_data).switch {
              FinalizeClose => true,
              FinalizeDelist => true,
              else => false
            };

          assert_output_with_correct_project_id(project_txinput.output, datum.project_id);

          check_latest_script_version(own_validator_hash, pparams_datum);

          is_producing_utxo_valid
            && does_consume_project_correctly

        },
        Delist => {
          own_output_txout: TxOutput =
            tx.outputs_locked_by(ctx.get_current_validator_hash())
              .head;

          own_output_datum: Datum = get_own_output_datum(own_output_txout);

          project_txinput: TxInput = get_project_txinput(tx.ref_inputs + tx.inputs);

          is_producing_utxo_valid: Bool =
            own_output_txout.address == Address::new(
              own_input_txout.address.credential,
              Option[StakingCredential]::Some{
                scriptHashToStakingCredential(
                  pparams_datum.registry.protocol_staking_validator
                )
              }
            )
              && own_output_txout.value == own_input_txout.value
              && own_output_datum == datum;

          project_script_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(project_txinput.output_id);

          project_redeemer_data: Data = tx.redeemers.get(project_script_purpose);

          does_consume_project_correctly: Bool =
            ProjectRedeemer::from_data(project_redeemer_data).switch {
              FinalizeClose => true,
              FinalizeDelist => true,
              else => false
            };

          assert_output_with_correct_project_id(project_txinput.output, datum.project_id);

          check_latest_script_version(own_validator_hash, pparams_datum);

          is_producing_utxo_valid
            && does_consume_project_correctly

        },
        Migrate => {
          migration_asset_class: AssetClass =
            pparams_datum
              .registry
              .project_detail_validator
              .migrations
              .get(own_validator_hash);

          tx.minted.get_safe(migration_asset_class) != 0
        }
      }
    }
  `;
}
