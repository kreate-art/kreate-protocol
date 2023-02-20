import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  projectAtMph: Hex;
  protocolNftMph: Hex;
};

export default function main({ projectAtMph, protocolNftMph }: Params) {
  return helios`
    ${header("spending", "v__dedicated_treasury")}

    import {
      RATIO_MULTIPLIER,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_DETAIL_AT_TOKEN_NAME,
      TREASURY_UTXO_MIN_ADA,
      TREASURY_MIN_WITHDRAWAL_ADA,
      TREASURY_REVOKE_DISCOUNT_CENTS,
      TREASURY_WITHDRAWAL_DISCOUNT_RATIO
    } from constants

    import {
      find_pparams_datum_from_inputs,
      script_hash_to_staking_credential,
      is_tx_authorized_by,
      min, max
    } from ${module("helpers")}

    import { UserTag, TreasuryTag }
      from ${module("common__types")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import {
      Datum as ProjectDetailDatum,
      Redeemer as ProjectDetailRedeemer
    } from ${module("v__project_detail__types")}

    import {
      Datum as ProjectDatum
    } from ${module("v__project__types")}

    import { Datum as OpenTreasuryDatum }
      from ${module("v__open_treasury__types")}

    import { Datum as SharedTreasuryDatum }
      from ${module("v__shared_treasury__types")}

    import { Datum, Redeemer }
      from ${module("v__dedicated_treasury__types")}

    const PROJECT_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectAtMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_DETAIL_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_DETAIL_AT_TOKEN_NAME)

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(datum: Datum, redeemer: Redeemer, ctx:ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_spending_input: TxInput = ctx.get_current_input();

      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      redeemer.switch {

        collect: CollectFees => {
          assert(
            own_validator_hash ==
              pparams_datum.registry.dedicated_treasury_validator.latest,
            "Wrong script version"
          );

          fees: Int = collect.fees;
          split: Bool = collect.split;
          assert(fees > 0 || split, "Fees > 0 or Split");

          project_id: ByteArray = datum.project_id;

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
              Update => true,
              else => false
            },
            "Wrong project detail redeemer"
          );

          own_spending_output: TxOutput = own_spending_input.output;

          treasury_tag: TreasuryTag =
            TreasuryTag::TagContinuation {former: own_spending_input.output_id};

          // This check is performed for batch processing purposes.
          own_address: Address = own_spending_output.address;
          own_producing_output: TxOutput =
            tx.outputs.find(
              (output: TxOutput) -> {
                output.address == own_address
                  && output.value.to_map().length == 1
                  && output.datum.switch {
                      i: Inline => {
                        output_datum: Datum = Datum::from_data(i.data);
                        output_datum.project_id == project_id
                          && output_datum.tag == treasury_tag
                      },
                      else => error("Invalid dedicated treasury UTxO: Missing inline datum")
                    }
              }
            );

          own_producing_datum: Datum = own_producing_output.datum.switch {
            i: Inline => Datum::from_data(i.data),
            else => error("Invalid dedicated treasury UTxO: Missing inline datum")
          };

          num_shared: Int =
            if (split) {
              shared_treasury_address: Address =
                Address::new(
                  Credential::new_validator(
                    pparams_datum.registry.shared_treasury_validator.latest
                  ),
                  Option[StakingCredential]::Some {
                    script_hash_to_staking_credential(
                      pparams_datum.registry.protocol_staking_validator
                    )
                  }
                );
              shared_treasury_value: Value =
                Value::lovelace(TREASURY_UTXO_MIN_ADA);

              count: Int = tx.outputs.fold(
                (acc: Int, output: TxOutput) -> {
                  if (
                    output.address == shared_treasury_address
                      && output.value == shared_treasury_value
                      && output.datum.switch {
                        i: Inline => {
                          shared_treasury_datum: SharedTreasuryDatum =
                            SharedTreasuryDatum::from_data(i.data);
                          shared_treasury_datum.project_id == project_id
                            && shared_treasury_datum.tag == treasury_tag
                            && shared_treasury_datum.governor_teiki == 0
                            && shared_treasury_datum.project_teiki.switch {
                              TeikiEmpty => true,
                              else => false
                            }
                        },
                        else => false
                      }
                  ) {
                    acc + 1
                  } else {
                    acc
                  }
                },
                0
              );
              assert(
                count >= pparams_datum.min_treasury_per_milestone_event,
                "Number of shared treasury not enough"
              );
              count
            } else {
              0
            };

          in_w: Int = own_spending_output.value.get(AssetClass::ADA);
          in_g: Int = min(max(0, datum.governor_ada), in_w);
          out_w: Int = own_producing_output.value.get(AssetClass::ADA);
          out_g: Int = own_producing_datum.governor_ada;

          0 <= out_g && out_g <= out_w
            && out_w == in_w + fees - (num_shared * TREASURY_UTXO_MIN_ADA)
            && out_g == in_g + fees * pparams_datum.governor_share_ratio / RATIO_MULTIPLIER
        },

        WithdrawAda => {
          assert(
            own_validator_hash ==
              pparams_datum.registry.dedicated_treasury_validator.latest,
            "Wrong script version"
          );

          project_id: ByteArray = datum.project_id;

          is_valid_project_output = (output: TxOutput) -> {
            output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
              && output.datum.switch {
                  i: Inline => {
                    project_datum: ProjectDatum = ProjectDatum::from_data(i.data);
                    project_datum.project_id == project_id
                      && project_datum.status.switch {
                        Active => true,
                        PreClosed => true,
                        PreDelisted => true,
                        else => false
                      }
                  },
                  else => false
                }
          };

          assert(
            tx.ref_inputs
              .map((input: TxInput) -> { input.output })
              .any(is_valid_project_output)
              || tx.outputs.any(is_valid_project_output),
            "Missing valid project utxo in reference inputs or outputs"
          );

          own_spending_output: TxOutput = own_spending_input.output;
          own_spending_output_id: TxOutputId = own_spending_input.output_id;

          spending_total_ada: Int = own_spending_output.value.get_safe(AssetClass::ADA);
          spending_governor_ada: Int = datum.governor_ada;

          min_remaining_ada: Int =
            (1 + pparams_datum.min_treasury_per_milestone_event) * TREASURY_UTXO_MIN_ADA;

          withdrawn_ada: Int = min(datum.governor_ada, spending_total_ada - min_remaining_ada);

          own_producing_address: Address = own_spending_output.address;
          own_producing_value: Value = Value::lovelace(spending_total_ada - withdrawn_ada);
          own_producing_datum: Datum =
            Datum {
              project_id: project_id,
              governor_ada: spending_governor_ada - withdrawn_ada,
              tag: TreasuryTag::TagContinuation {former: own_spending_output_id}
            };

          assert(
            tx.outputs.any((output: TxOutput) -> {
              output.address == own_producing_address
                && output.value == own_producing_value
                  && output.datum.switch {
                      i: Inline => Datum::from_data(i.data) == own_producing_datum,
                      else => error("Invalid dedicated treasury UTxO: Missing inline datum")
                    }
            }),
            "Incorrect producing dedicated treasury output"
          );

          governor_address: Address = pparams_datum.governor_address;

          if (is_tx_authorized_by(tx, governor_address.credential)) {
            withdrawn_ada > 0
          } else {
            assert(
              withdrawn_ada >= TREASURY_MIN_WITHDRAWAL_ADA,
              "Withdrawn ADA amount must be bigger than min withdrawal"
            );

            governor_value: Value =
              Value::lovelace(
                withdrawn_ada * (RATIO_MULTIPLIER - TREASURY_WITHDRAWAL_DISCOUNT_RATIO) / RATIO_MULTIPLIER
              );

            governor_tag: UserTag =
              UserTag::TagTreasuryWithdrawal {
                treasury_output_id: Option[TxOutputId]::Some { own_spending_output_id }
              };

            tx.outputs.any(
              (output: TxOutput) -> {
                output.address == governor_address
                  && output.value == governor_value
                  && output.datum.switch {
                    i: Inline => UserTag::from_data(i.data) == governor_tag,
                    else => false
                  }
              }
            )
          }
        },

        Revoke => {
          assert(
            own_validator_hash ==
              pparams_datum.registry.dedicated_treasury_validator.latest,
            "Wrong script version"
          );

          project_id: ByteArray = datum.project_id;

          is_valid_project_output = (output: TxOutput) -> {
            output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
              && output.datum.switch {
                  i: Inline => {
                    project_datum: ProjectDatum = ProjectDatum::from_data(i.data);
                    project_datum.project_id == project_id
                      && project_datum.status.switch {
                        Closed => true,
                        Delisted => true,
                        else => false
                      }
                  },
                  else => false
                }
          };

          assert(
            tx.ref_inputs
              .map((input: TxInput) -> { input.output })
              .any(is_valid_project_output)
              || tx.outputs.any(is_valid_project_output),
            "Missing valid project utxo in reference inputs or outputs"
          );

          own_spending_output: TxOutput = own_spending_input.output;

          ada_to_treasury: Int =
            own_spending_output.value.get_safe(AssetClass::ADA)
              - pparams_datum.discount_cent_price * TREASURY_REVOKE_DISCOUNT_CENTS;

          open_treasury_address: Address =
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

          open_treasury_tag: TreasuryTag =
            TreasuryTag::TagContinuation {former: own_spending_input.output_id};

          if (ada_to_treasury > 0) {
            tx.outputs.any(
              (output: TxOutput) -> {
                if (
                  output.address == open_treasury_address
                    && output.value.to_map().length == 1
                ) {
                  treasury_ada: Int = output.value.get(AssetClass::ADA);
                  treasury_ada >= ada_to_treasury
                    && output.datum.switch {
                      i: Inline => {
                        open_treasury_datum: OpenTreasuryDatum = OpenTreasuryDatum::from_data(i.data);
                        open_treasury_datum.tag == open_treasury_tag
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
