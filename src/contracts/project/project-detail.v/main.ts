import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  projectAtMph: Hex;
  protocolNftMph: Hex;
};

export default function main({ projectAtMph, protocolNftMph }: Params) {
  return helios`
    ${header("spending", "v__project_detail")}

    import {
      ADA_MINTING_POLICY_HASH,
      ADA_TOKEN_NAME,
      RATIO_MULTIPLIER,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO,
      PROJECT_NEW_MILESTONE_DISCOUNT_CENTS,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      PROJECT_SPONSORSHIP_RESOLUTION
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

    import {
      Datum as DedicatedTreasuryDatum,
      Redeemer as DedicatedTreasuryRedeemer
    } from ${module("v__dedicated_treasury__types")}

    import {
      ProjectStatus,
      Redeemer as ProjectRedeemer,
      Datum as ProjectDatum
    } from ${module("v__project__types")}

    import { Datum as ProjectScriptDatum }
      from ${module("v__project_script__types")}

    import { Datum, Redeemer, Sponsorship }
      from ${module("v__project_detail__types")}

    const PROJECT_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectAtMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_SCRIPT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_SCRIPT_AT_TOKEN_NAME)

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func is_project_output(output: TxOutput) -> Bool {
      output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
    }

    func get_project_datum(output: TxOutput) -> ProjectDatum {
      output.datum.switch {
        i: Inline => ProjectDatum::from_data(i.data),
        else => error("Invalid Project utxo: missing inline datum")
      }
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

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      redeemer.switch {

        Migrate => {
          migration_asset_class: AssetClass =
            pparams_datum
              .registry
              .project_detail_validator
              .migrations
              .get(own_validator_hash);
          tx.minted.get_safe(migration_asset_class) != 0
        },

        else => {
          assert(
            own_validator_hash ==
              pparams_datum.registry.project_detail_validator.latest,
            "Wrong script version"
          );

          own_spending_output: TxOutput = ctx.get_current_input().output;

          project_id: ByteArray = datum.project_id;

          redeemer.switch {

            WithdrawFunds => {
              is_project_input = (input: TxInput) -> { is_project_output(input.output) };
              project_input: TxInput =
                tx.ref_inputs
                  .find_safe(is_project_input)
                  .switch {
                    None => tx.inputs.find(is_project_input),
                    s: Some => s.some
                  };

              project_datum: ProjectDatum = get_project_datum(project_input.output);
              assert(project_datum.project_id == project_id, "Invalid project id");

              assert(
                project_datum.status.switch {
                  Active => true,
                  PreClosed => true,
                  else => false
                },
                "Invalid project status"
              );

              withdrawals: Map[StakingCredential]Int = tx.withdrawals;

              total_withdrawal: Int =
                calculate_total_withdrawal(withdrawals, tx.inputs, project_id)
                  + calculate_total_withdrawal(withdrawals, tx.ref_inputs, project_id);

              new_withdrawn_funds: Int = datum.withdrawn_funds + total_withdrawal;

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

                            output_datum.project_id == project_id
                              && output_datum.withdrawn_funds == new_withdrawn_funds
                              && output_datum.sponsorship == datum.sponsorship
                              && output_datum.information_cid == datum.information_cid
                              && output_datum.last_announcement_cid == datum.last_announcement_cid
                          },
                          else => error("Invalid project detail UTxO: missing inline datum")
                        }
                  }
                ),
                "Incorrect producing project detail output"
              );

              milestone: Int =
                pparams_datum.project_milestones.fold(
                  (acc: Int, lovelace: Int) -> {
                    if (new_withdrawn_funds < lovelace) { acc }
                    else { acc + 1 }
                  },
                  0
                );

              is_new_milestone_reached: Bool = milestone > project_datum.milestone_reached;

              dedicated_treasury_credential: Credential =
                Credential::new_validator(
                  pparams_datum.registry.dedicated_treasury_validator.latest
                );
              dedicated_treasury_input: TxInput =
                tx.inputs.find(
                  (input: TxInput) -> {
                    output: TxOutput = input.output;
                    if (output.address.credential == dedicated_treasury_credential) {
                      output.datum.switch {
                        i: Inline =>
                          DedicatedTreasuryDatum::from_data(i.data).project_id == project_id,
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

              assert(
                DedicatedTreasuryRedeemer::from_data(dedicated_treasury_redeemer).switch {
                  collect_fees: CollectFees => {
                    collect_fees.split == is_new_milestone_reached
                      && collect_fees.fees == fees
                  },
                  else => false
                },
                "Dedicated treasury not consumed correctly"
              );

              project_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_input.output_id);

              project_redeemer: Option[Data] = tx.redeemers.get_safe(project_purpose);

              if (is_new_milestone_reached) {
                assert(
                  ProjectRedeemer::from_data(project_redeemer.unwrap()).switch {
                    record: RecordNewMilestone => record.new_milestone == milestone,
                    else => false
                  },
                  "Incorect project redeemer"
                )
              } else {
                assert(
                  project_redeemer.switch {
                    None => true,
                    else => false
                  },
                  "Must not consume any project output"
                )
              };

              if (is_tx_authorized_by(tx, project_datum.owner_address.credential)) {
                true
              } else {
                discount: Int =
                  total_withdrawal * PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO / RATIO_MULTIPLIER
                  + if (is_new_milestone_reached) {
                      pparams_datum.discount_cent_price * PROJECT_NEW_MILESTONE_DISCOUNT_CENTS
                    } else {
                      0
                    };

                owner_ada: Int = total_withdrawal - fees - discount;

                owner_address: Address = project_datum.owner_address;

                tx.outputs.any(
                  (output: TxOutput) -> Bool {
                    output.address == owner_address
                      && output.value.to_map().all(
                          (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> {
                            if (mph == ADA_MINTING_POLICY_HASH) {
                              tokens.get(ADA_TOKEN_NAME) >= owner_ada
                            } else {
                              false
                            }
                          }
                        )
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
              }
            },

            Update => {
              extract_output = (input: TxInput) -> { input.output };
              project_output: TxOutput =
                tx.ref_inputs
                  .map(extract_output)
                  .find_safe(is_project_output)
                  .switch {
                    None =>
                      tx.inputs
                        .map(extract_output)
                        .find(is_project_output),
                    s: Some => s.some
                  };

              project_datum: ProjectDatum = get_project_datum(project_output);
              assert(project_datum.project_id == datum.project_id, "Invalid project id");

              assert(
                project_datum.status.switch {
                  Active => true,
                  PreClosed => true,
                  PreDelisted => true,
                  else => false
                },
                "Invalid project status"
              );

              own_address: Address = own_spending_output.address;
              own_value: Value = own_spending_output.value;

              own_producing_output: TxOutput =
                tx.outputs.find(
                  (output: TxOutput) -> {
                    output.address == own_address
                      && output.value == own_value
                      && output.datum.switch {
                        i: Inline => {
                          output_datum: Datum = Datum::from_data(i.data);

                          output_datum.project_id == project_id
                            && output_datum.withdrawn_funds == datum.withdrawn_funds
                        },
                        else => error("Invalid project detail UTxO: missing inline datum")
                      }
                  }
                );

              own_producing_datum: Datum =
                own_producing_output.datum.switch {
                  i: Inline => Datum::from_data(i.data),
                  else => error("Invalid project detail UTxO: missing inline datum")
                };

              is_sponsorship_changed: Bool =
                own_producing_datum.sponsorship != datum.sponsorship;
              is_information_changed: Bool =
                own_producing_datum.information_cid != datum.information_cid;
              is_announcement_changed: Bool =
                own_producing_datum.last_announcement_cid != datum.last_announcement_cid;

              assert(
                is_sponsorship_changed || is_information_changed || is_announcement_changed,
                "Must update at least one field"
              );

              sponsorship_fee: Int =
                if (is_sponsorship_changed) {
                  own_producing_datum.sponsorship.switch {
                    None => {
                      assert(
                        datum.sponsorship.switch {
                          None => error("Unreachable"),
                          o: Some => tx.time_range.start >= o.some.until
                        },
                        "Invalid time range to update sponsorship"
                      );
                      0
                    },
                    so: Some => {
                      amount: Int = so.some.amount;
                      until: Time = so.some.until;

                      assert(
                        amount >= pparams_datum.project_sponsorship_min_fee,
                        "Sponsorship amount must be higher than minimum"
                      );

                      assert(
                        until == tx.time_range.start + pparams_datum.project_sponsorship_duration,
                        "Invalid sponsorship until"
                      );

                      datum.sponsorship.switch {
                        None => amount,
                        si: Some => {
                          sp: Sponsorship = si.some;

                          duration: Duration = pparams_datum.project_sponsorship_duration;
                          resolution: Duration = PROJECT_SPONSORSHIP_RESOLUTION;

                          raw_leftover: Duration = sp.until - tx.time_range.start;

                          duration_zero: Duration = Duration::new(0);
                          leftover: Duration =
                            if (raw_leftover > duration_zero) {
                              if (duration < raw_leftover) { duration }
                              else { raw_leftover }
                            } else {
                              duration_zero
                            };

                          discount: Int = sp.amount * (leftover / resolution) / (duration / resolution);

                          if (amount > discount) { amount - discount }
                          else { 0 }
                        }
                      }
                    }
                  }
                } else {
                  0
                };

              information_fee: Int =
                if (is_information_changed) {
                  assert(
                    own_producing_datum.information_cid != "",
                    "information_cid can't be empty"
                  );
                  pparams_datum.project_information_update_fee
                } else {
                  0
                };

              announcement_fee: Int =
                if (is_announcement_changed) {
                  assert(
                    own_producing_datum.last_announcement_cid.unwrap() != "",
                    "last_announcement_cid can't be empty"
                  );
                  pparams_datum.project_announcement_fee
                } else {
                  0
                };

              total_fees: Int = sponsorship_fee + information_fee + announcement_fee;

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
                        output: TxOutput = input.output;

                        output.address.credential == dedicated_treasury_credential
                          && output.datum.switch {
                              i: Inline =>
                                DedicatedTreasuryDatum::from_data(i.data).project_id == project_id,
                              else => false
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
              } else {
                true
              };

              is_tx_authorized_by(tx, project_datum.owner_address.credential)
                && does_consume_treasury_correctly
            },

            Close => {
              project_input: TxInput = tx.inputs.find(
                (input: TxInput) -> { is_project_output(input.output) }
              );

              expected_address: Address =
                Address::new(
                    own_spending_output.address.credential,
                    Option[StakingCredential]::Some{
                      script_hash_to_staking_credential(
                        pparams_datum.registry.protocol_staking_validator
                      )
                    }
                );

              expected_value: Value =
                own_spending_output.value;

              is_producing_utxo_valid: Bool =
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == expected_address
                      && output.value == expected_value
                      && output.datum.switch {
                          i: Inline => Datum::from_data(i.data) == datum,
                          else => error("Invalid project detail UTxO: missing inline datum")
                        }
                  }
                );

              project_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_input.output_id);

              project_redeemer: Data = tx.redeemers.get(project_purpose);

              does_consume_project_correctly: Bool =
                ProjectRedeemer::from_data(project_redeemer).switch {
                  FinalizeClose => true,
                  else => false
                };

              assert(
                get_project_datum(project_input.output).project_id == project_id,
                "Invalid project id"
              );

              is_producing_utxo_valid
                && does_consume_project_correctly
            },

            Delist => {
              project_input: TxInput = tx.inputs.find(
                (input: TxInput) -> { is_project_output(input.output) }
              );

              expected_address: Address =
                Address::new(
                    own_spending_output.address.credential,
                    Option[StakingCredential]::Some{
                      script_hash_to_staking_credential(
                        pparams_datum.registry.protocol_staking_validator
                      )
                    }
                );

              expected_value: Value =
                own_spending_output.value;

              is_producing_utxo_valid: Bool =
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == expected_address
                      && output.value == expected_value
                      && output.datum.switch {
                          i: Inline => Datum::from_data(i.data) == datum,
                          else => error("Invalid project detail UTxO: missing inline datum")
                        }
                  }
                );

              project_purpose: ScriptPurpose =
                ScriptPurpose::new_spending(project_input.output_id);

              project_redeemer: Data = tx.redeemers.get(project_purpose);

              does_consume_project_correctly: Bool =
                ProjectRedeemer::from_data(project_redeemer).switch {
                  FinalizeDelist => true,
                  else => false
                };

              assert(
                get_project_datum(project_input.output).project_id == project_id,
                "Invalid project id"
              );

              is_producing_utxo_valid
                && does_consume_project_correctly

            },

            else => false

          }
        }
      }
    }
  `;
}
