import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  projectAtMph: Hex;
  protocolNftMph: Hex;
};

export default function main({ projectAtMph, protocolNftMph }: Params) {
  return helios`
    ${header("spending", "v__project_detail")}

    import { Datum, Redeemer }
      from ${module("v__project_detail__types")}
    import { UserTag }
      from ${module("common__types")}
    import {
      ProjectStatus,
      Redeemer as ProjectRedeemer,
      Datum as ProjectDatum
    } from ${module("v__project__types")}
    import { Datum as ProjectScriptDatum }
      from ${module("v__project_script__types")}
    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}
    import {
      Datum as DedicatedTreasuryDatum,
      Redeemer as DedicatedTreasuryRedeemer
    } from ${module("v__dedicated_treasury__types")}

    import {
      find_pparams_datum_from_inputs,
      is_tx_authorized_by,
      script_hash_to_staking_credential
    } from ${module("helpers")}

    import {
      RATIO_MULTIPLIER,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO,
      PROJECT_NEW_MILESTONE_DISCOUNT_CENTS,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      PROJECT_SPONSORSHIP_RESOLUTION
    } from ${module("constants")}

    const PROJECT_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectAtMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_SCRIPT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_SCRIPT_AT_TOKEN_NAME)

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

      assert(
        project_datum.project_id == project_id,
        "Wrong project_id"
      )
    }

    func get_own_output_datum (output: TxOutput) -> Datum {
      output.datum.switch {
        i: Inline => Datum::from_data(i.data),
        else => error("Invalid project detail UTxO: missing inline datum")
      }
    }

    func check_latest_script_version (
      own_validator_hash: ValidatorHash,
      pparams_datum: PParamsDatum
    ) -> () {
      assert(
        own_validator_hash ==
          pparams_datum.registry.project_detail_validator.latest,
        "Wrong script version"
      )
    }

    func extract_project_id_from_project_script_datum(data: Data) -> Option[ByteArray] {
      // TODO: Extremely error prone
      data.switch {
        l: []Data => {
          if (l.is_empty()) {
            Option[ByteArray]::None
          } else {
            l.head.switch {
              b: ByteArray => {
                Option[ByteArray]::Some { b }
              },
              else => Option[ByteArray]::None
            }
          }
        },
        else => Option[ByteArray]::None
      }
    }

    func calculate_total_withdrawal(
      withdrawals: Map[StakingCredential]Int,
      inputs: []TxInput,
      project_id: ByteArray
    ) -> Int {
      inputs.fold(
        (acc: Int, input: TxInput) -> Int {
          output: TxOutput = input.output;
          output.ref_script_hash.switch {
            sh: Some => {
              output.datum.switch {
                i: Inline => {
                  extract_project_id_from_project_script_datum(i.data).switch {
                    si: Some => {
                      if (si.some == project_id) {
                        acc + withdrawals.get(script_hash_to_staking_credential(sh.some))
                      } else {
                        acc
                      }
                    },
                    else => acc
                  }
                },
                else => acc
              }
            },
            else => acc
          }
        },
        0
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

          project_txinput: TxInput = get_project_txinput(tx.ref_inputs + tx.inputs);

          project_datum: ProjectDatum =
            get_project_datum_with_project_id(project_txinput.output, datum.project_id);

          is_project_status_valid: Bool =
            project_datum.status.switch {
              Active => true,
              PreClosed => true,
              else => false
            };

          withdrawals: Map[StakingCredential]Int = tx.withdrawals;

          total_withdrawal: Int =
            calculate_total_withdrawal(withdrawals, tx.inputs, datum.project_id)
              + calculate_total_withdrawal(withdrawals, tx.ref_inputs, datum.project_id);

          new_withdrawn_funds: Int = datum.withdrawn_funds + total_withdrawal;

          is_own_output_valid: Bool =
            tx.outputs.any(
              (output: TxOutput) -> Bool {
                output.address == own_input_txout.address
                  && output.value == own_input_txout.value
                  && output.datum.switch {
                    i: Inline => {
                      output_datum: Datum = Datum::from_data(i.data);

                      datum.project_id == output_datum.project_id
                        && output_datum.withdrawn_funds == new_withdrawn_funds
                        && datum.sponsorship == output_datum.sponsorship
                        && datum.information_cid == output_datum.information_cid
                        && datum.last_announcement_cid
                            == output_datum.last_announcement_cid
                    },
                    else => error("Invalid project detail UTxO: missing inline datum")
                  }
              }
            );

          milestone: Int =
            pparams_datum.project_milestones.fold(
              (acc: Int, lovelace: Int) -> Int {
                if (new_withdrawn_funds >= lovelace){
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

          dedicated_treasury_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(dedicated_treasury_input.output_id);

          dedicated_treasury_redeemer: Data =
            tx.redeemers.get(dedicated_treasury_purpose);

          fees: Int =
            total_withdrawal * pparams_datum.protocol_funds_share_ratio / RATIO_MULTIPLIER;

          does_consume_treasury_correctly: Bool =
            DedicatedTreasuryRedeemer::from_data(dedicated_treasury_redeemer).switch {
              collect_fees: CollectFees => {
                collect_fees.split == is_new_milestone_reached
                  && collect_fees.fees == fees
              },
              else => false
            };

          does_consume_project_utxo: Bool =
            if (is_new_milestone_reached) {
              project_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_txinput.output_id);

              project_redeemer: Data = tx.redeemers.get(project_purpose);

              ProjectRedeemer::from_data(project_redeemer).switch {
                record: RecordNewMilestone => record.new_milestone == milestone,
                else => false
              }
            } else {
              true
            };

          does_send_rewards_correctly: Bool =
            if (!is_tx_authorized_by(tx, project_datum.owner_address.credential)) {
              discount: Int =
                total_withdrawal * PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO / RATIO_MULTIPLIER
                + if (is_new_milestone_reached) {
                  pparams_datum.discount_cent_price * PROJECT_NEW_MILESTONE_DISCOUNT_CENTS
                } else {
                  0
                };

              tx.outputs.any(
                (output: TxOutput) -> Bool {
                  output.address == project_datum.owner_address
                    && output.value.get(AssetClass::ADA)
                        >= (total_withdrawal - fees - discount)
                    && output.datum.switch {
                      i: Inline =>
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

          check_latest_script_version(own_validator_hash, pparams_datum);

          is_project_status_valid
            && does_consume_treasury_correctly
            && does_consume_project_utxo
            && does_send_rewards_correctly
            && is_own_output_valid
        },
        Update => {
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

          own_output_txout: TxOutput =
            tx.outputs.find(
              (output: TxOutput) -> Bool {
                own_input_txout.address == output.address
                  && own_input_txout.value == output.value
                  && output.datum.switch {
                    i: Inline => {
                      output_datum: Datum = Datum::from_data(i.data);

                      datum.project_id == output_datum.project_id
                        && datum.withdrawn_funds == output_datum.withdrawn_funds
                        && (
                          datum.sponsorship != output_datum.sponsorship
                            || datum.information_cid != output_datum.information_cid
                            || datum.last_announcement_cid
                                != output_datum.last_announcement_cid
                        )
                    },
                    else => error("Invalid project detail UTxO: missing inline datum")
                  }
              }
            );

          own_output_datum: Datum = get_own_output_datum(own_output_txout);

          update_sponsor_fee: Int =
            if (datum.sponsorship == own_output_datum.sponsorship){ 0 }
            else {
              own_output_datum.sponsorship.switch {
                None => {
                  assert(
                    datum.sponsorship.switch {
                      None => error("Unreachable"),
                      o: Some => o.some.until <= tx.time_range.start
                    },
                    "Invalid time range to update sponsorship"
                  );

                  0
                },
                s: Some => {
                  amount: Int = s.some.amount;
                  until: Time = s.some.until;

                  assert(
                    amount >= pparams_datum.project_sponsorship_min_fee,
                    "Invalid sponsorship amount"
                  );

                  assert(
                    until == tx.time_range.start + pparams_datum.project_sponsorship_duration,
                    "Invalid sponsorship until"
                  );

                  datum.sponsorship.switch {
                    None => amount,
                    os: Some => {
                      o_amount: Int = os.some.amount;
                      o_until: Time = os.some.until;

                      now: Time = tx.time_range.start;
                      duration: Duration = pparams_datum.project_sponsorship_duration;
                      resolution: Duration = PROJECT_SPONSORSHIP_RESOLUTION;

                      delta_duration: Duration = o_until - now;

                      leftover: Duration =
                        if (delta_duration < Duration::new(0)) { Duration::new(0) }
                        else {
                          if (duration > delta_duration) { delta_duration }
                          else { duration }
                        };

                      discount: Int = o_amount * (leftover / resolution) / (duration / resolution);

                      if (amount  > discount) { amount - discount }
                      else { 0 }
                    }
                  }
                }
              }
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

          update_announcement_fee: Int =
            if (datum.last_announcement_cid != own_output_datum.last_announcement_cid) {
              if (own_output_datum.last_announcement_cid.unwrap().encode_utf8().length > 0){
                pparams_datum.project_announcement_fee
              } else {
                error("Invalid announcement cid")
              }
            } else {
              0
            };

          total_fees: Int = update_sponsor_fee + update_info_fee + update_announcement_fee;

          does_consume_treasury_correctly: Bool =
            if (total_fees > 0) {
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

              dedicated_treasury_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(dedicated_treasury_input.output_id);

              dedicated_treasury_redeemer: Data =
                tx.redeemers.get(dedicated_treasury_purpose);


              DedicatedTreasuryRedeemer::from_data(dedicated_treasury_redeemer).switch {
                collect_fees: CollectFees => {
                  collect_fees.split == false
                    && collect_fees.fees == total_fees
                },
                else => false
              }
          }
          else { true };

          check_latest_script_version(own_validator_hash, pparams_datum);

          is_tx_authorized_by(tx, project_datum.owner_address.credential)
            && is_project_status_valid
            && does_consume_treasury_correctly
        },
        Close => {
          project_txinput: TxInput = get_project_txinput(tx.ref_inputs + tx.inputs);

          is_producing_utxo_valid: Bool =
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
                && output.value == own_input_txout.value
                && output.datum.switch {
                  i: Inline => Datum::from_data(i.data) == datum,
                  else => error("Invalid project detail UTxO: missing inline datum")
                }
              }
            );

          project_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(project_txinput.output_id);

          project_redeemer: Data = tx.redeemers.get(project_purpose);

          does_consume_project_correctly: Bool =
            ProjectRedeemer::from_data(project_redeemer).switch {
              FinalizeClose => true,
              else => false
            };

          assert_output_with_correct_project_id(project_txinput.output, datum.project_id);

          check_latest_script_version(own_validator_hash, pparams_datum);

          is_producing_utxo_valid
            && does_consume_project_correctly

        },
        Delist => {
          project_txinput: TxInput = get_project_txinput(tx.ref_inputs + tx.inputs);

          is_producing_utxo_valid: Bool =
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
                && output.value == own_input_txout.value
                && output.datum.switch {
                  i: Inline => Datum::from_data(i.data) == datum,
                  else => error("Invalid project detail UTxO: missing inline datum")
                }
              }
            );

          project_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(project_txinput.output_id);

          project_redeemer: Data = tx.redeemers.get(project_purpose);

          does_consume_project_correctly: Bool =
            ProjectRedeemer::from_data(project_redeemer).switch {
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
