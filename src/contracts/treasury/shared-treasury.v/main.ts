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
    ${header("spending", "v__shared_treasury")}

    import {
      ADA_MINTING_POLICY_HASH,
      ADA_TOKEN_NAME,
      RATIO_MULTIPLIER,
      PROJECT_AT_TOKEN_NAME,
      TEIKI_TOKEN_NAME
    } from ${module("constants")}

    import {
      find_pparams_datum_from_inputs,
      max,
      is_tx_authorized_by,
      script_hash_to_staking_credential
    } from ${module("helpers")}

    import { Fraction }
      from ${module("fraction")}

    import { TreasuryTag }
      from ${module("common__types")}

    import { Redeemer as TeikiRedeemer }
      from ${module("mp__teiki__types")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import { Datum as ProjectDatum }
      from ${module("v__project__types")}

    import { Datum as OpenTreasuryDatum }
      from ${module("v__open_treasury__types")}

    import { Datum, Redeemer, ProjectTeiki }
      from ${module("v__shared_treasury__types")}

    const PROJECT_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectAtMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECT_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const TEIKI_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${teikiMph})

    const TEIKI_ASSET_CLASS: AssetClass =
      AssetClass::new(TEIKI_MPH, TEIKI_TOKEN_NAME)

    // Synchronize with the calculateTeikiRemaining in transactions
    func calculate_teiki_remaining(
      available: Int,
      burn_rate_inv: Int,
      epochs: Int
    ) -> Int {
      r: Fraction =
        Fraction { numerator: burn_rate_inv, denominator: RATIO_MULTIPLIER }
          .exponential(epochs);
      (r.denominator - r.numerator) * available / r.denominator
    }

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      redeemer.switch {

        update: UpdateTeiki => {
          assert(
            own_validator_hash ==
              pparams_datum.registry.shared_treasury_validator.latest,
            "Wrong script version"
          );

          own_spending_input: TxInput = ctx.get_current_input();
          own_spending_output: TxOutput = own_spending_input.output;

          tx_time_start: Time = tx.time_range.start;

          project_teiki_state: ProjectTeiki = datum.project_teiki;

          project_available_teiki: Int =
            project_teiki_state.switch {
              TeikiEmpty => 0,
              burn: TeikiBurntPeriodically => {
                available: Int = burn.available;
                assert(
                  available >= 0 && tx_time_start >= burn.last_burn_at,
                  "Invalid project teiki burn state"
                );
                available
              },
              TeikiBurntEntirely => 0
            };

          governor_teiki: Int = datum.governor_teiki;
          spending_total_teiki: Int =
            own_spending_output.value.get_safe(TEIKI_ASSET_CLASS);

          assert(
            governor_teiki >= 0
              && governor_teiki + project_available_teiki <= spending_total_teiki,
            "Spending output is corrupted"
          );

          burn_amount: Int = update.burn_amount;
          rewards: Int = update.rewards;

          assert(
            if (burn_amount == 0) {
              rewards > 0 && tx.minted.get(TEIKI_ASSET_CLASS) > 0
            } else {
              rewards >= 0
            },
            "Invalid rewards"
          );

          project_id: ByteArray = datum.project_id;

          (new_project_teiki: ProjectTeiki, project_rewards: Int) =
            update.burn_action.switch {
              BurnPeriodically => {
                new_project_teiki: ProjectTeiki =
                  project_teiki_state.switch {
                    TeikiEmpty => {
                      assert(burn_amount != 0, "BP | Empty");
                      ProjectTeiki::TeikiBurntPeriodically {
                        available: update.rewards,
                        last_burn_at: tx.time_range.start
                      }
                    },
                    burn: TeikiBurntPeriodically => {
                      epochs: Int =
                        (tx_time_start - burn.last_burn_at) / pparams_datum.epoch_length;
                      if (epochs == 0) {
                        assert(burn_amount == 0, "BP | BurntPeriodically | epochs == 0");
                        ProjectTeiki::TeikiBurntPeriodically {
                          available: burn.available + rewards,
                          last_burn_at: burn.last_burn_at
                        }
                      } else {
                        burn_rate_inv: Int = RATIO_MULTIPLIER - pparams_datum.project_teiki_burn_rate;
                        available: Int = burn.available;
                        remaining: Int = calculate_teiki_remaining(available, burn_rate_inv, epochs);
                        assert(burn_amount == available - remaining, "BP | BurntPeriodically | epochs > 0");
                        ProjectTeiki::TeikiBurntPeriodically {
                          available: remaining + update.rewards,
                          last_burn_at: burn.last_burn_at + epochs * pparams_datum.epoch_length
                        }
                      }
                    },
                    TeikiBurntEntirely => error("BP | BurntEntirely")
                  };
                (new_project_teiki, rewards)
              },
              BurnEntirely => {
                project_teiki_state.switch {
                  TeikiEmpty =>
                    assert(burn_amount == 0, "BE | Empty"),
                  TeikiBurntEntirely =>
                    assert(burn_amount == 0, "BE | BurntEntirely"),
                  burn: TeikiBurntPeriodically => {
                    assert(burn.available == burn_amount, "BE | BurntPeriodically");
                    assert(
                      tx.ref_inputs.any(
                        (input: TxInput) -> {
                          output: TxOutput = input.output;
                          output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                            && output.datum.switch {
                                i: Inline => {
                                  project_datum: ProjectDatum = ProjectDatum::from_data(i.data);
                                  project_datum.project_id == project_id
                                    && project_datum.status.switch {
                                      Delisted => true,
                                      else => false
                                    }
                                },
                                else => false
                              }
                        }
                      ),
                      "BE | BurntPeriodically | Must refer to a delisted project"
                    )
                  }
                };
              (ProjectTeiki::TeikiBurntEntirely, 0)
            }
          };

          producing_address: Address = own_spending_output.address;
          producing_value: Value =
            Value::from_map(
              Map[MintingPolicyHash]Map[ByteArray]Int {
                ADA_MINTING_POLICY_HASH: Map[ByteArray]Int {
                  ADA_TOKEN_NAME: own_spending_output.value.get(AssetClass::ADA)
                },
                TEIKI_MPH: Map[ByteArray]Int {
                  TEIKI_TOKEN_NAME:
                    spending_total_teiki + rewards + project_rewards - burn_amount
                }
              }
            );
          producing_datum: Datum =
            Datum {
              project_id: project_id,
              governor_teiki:
                governor_teiki + rewards * pparams_datum.governor_share_ratio / RATIO_MULTIPLIER,
              project_teiki: new_project_teiki,
              tag: TreasuryTag::TagContinuation {former: own_spending_input.output_id}
            };

          tx.outputs.any(
            (output: TxOutput) -> {
              output.address == producing_address
                && output.value == producing_value
                && output.datum.switch {
                  i: Inline => Datum::from_data(i.data) == producing_datum,
                  else => error("Invalid Share treasury output UTxO: missing inline datum")
                }
            }
          )
        },

        Migrate => {
          migration_asset_class: AssetClass =
            pparams_datum
              .registry
              .shared_treasury_validator
              .migrations
              .get(own_validator_hash);
          tx.minted.get_safe(migration_asset_class) != 0
        }

      }
    }
  `;
}
