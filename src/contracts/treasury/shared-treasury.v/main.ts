import { Hex } from "@/types";

import { helios } from "../../program";

export type SharedTreasuryParams = {
  projectAtMph: Hex;
  protocolNftMph: Hex;
  teikiMph: Hex;
  proofOfBackingMph: Hex;
};

export default function main({
  projectAtMph,
  protocolNftMph,
  teikiMph,
  proofOfBackingMph,
}: SharedTreasuryParams) {
  return helios("v__shared_treasury", [
    "v__shared_treasury__types",
    "v__protocol_params__types",
    "v__project__types",
    "mp__teiki__types",
    "v__open_treasury__types",
    "mp__proof_of_backing__types",
    "fraction",
    "helpers",
    "constants",
  ])`
    spending v__shared_treasury

    import {
      Datum,
      Redeemer,
      BurnActionResult,
      ProjectTeiki
    } from v__shared_treasury__types
    import { Datum as PParamsDatum } from v__protocol_params__types
    import { Datum as ProjectDatum } from v__project__types
    import { Redeemer as TeikiRedeemer } from mp__teiki__types
    import { Datum as OpenTreasuryDatum } from v__open_treasury__types
    import { Redeemer as PoBRedeemer } from mp__proof_of_backing__types

    import { Fraction } from fraction

    import {
      find_pparams_datum_from_inputs,
      max,
      is_tx_authorized_by,
      scriptHashToStakingCredential
    } from helpers

    import {
      MULTIPLIER,
      PROJECT_AT_TOKEN_NAME,
      TEIKI_TOKEN_NAME
    } from constants

    const PROJECTS_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectAtMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const TEIKI_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${teikiMph})

    const TEIKI_ASSET_CLASS: AssetClass =
      AssetClass::new(TEIKI_MPH, TEIKI_TOKEN_NAME)

    const PROOF_OF_BACKING_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${proofOfBackingMph})

    // Synchronize with the calculateTeikiRemaining in transactions
    func calculate_teiki_remaining(
      available: Int,
      burn_rate_inv: Int,
      epochs: Int
    ) -> Int {
      r: Fraction =
        Fraction { numerator: burn_rate_inv, denominator: MULTIPLIER }
          .exponential(epochs);

      (r.denominator - r.numerator) * available / r.denominator
    }

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_input_txinput: TxInput = ctx.get_current_input();
      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      redeemer.switch {
        update_teiki: UpdateTeiki => {
          project_available_teiki: Int =
            datum.project_teiki.switch {
              TeikiEmpty => 0,
              burn_periodically: TeikiBurntPeriodically => {
                if (burn_periodically.available >= 0
                  && burn_periodically.last_burn_at <= tx.time_range.start
                ){
                  burn_periodically.available
                } else {
                  error("Invalid Share treasury datum")
                }
              },
              TeikiBurntEntirely => 0
            };

          is_spending_corrupted: Bool =
            datum.governor_teiki >= 0
              && datum.governor_teiki + project_available_teiki
                  <= own_input_txinput.output.value.get_safe(TEIKI_ASSET_CLASS);

          assert(is_spending_corrupted, "error is_spending_corrupted");

          burn_amount_condition: Bool =
            if (update_teiki.burn_amount == 0){
              pob_script_purpose: ScriptPurpose =
                ScriptPurpose::new_minting(PROOF_OF_BACKING_MPH);

              pob_redeemer_data: Data = tx.redeemers.get(pob_script_purpose);

              is_pob_redeemer_valid: Bool =
                PoBRedeemer::from_data(pob_redeemer_data).switch {
                  Migrate => false,
                  else => true
                };

              update_teiki.rewards > 0
                && is_pob_redeemer_valid
            } else {
              update_teiki.rewards >= 0
            };

          burn_action_result: BurnActionResult =
            update_teiki.burn_action.switch {
              BurnPeriodically => {
                new_project_teiki: ProjectTeiki =
                  datum.project_teiki.switch {
                    TeikiEmpty => {
                      if(update_teiki.burn_amount == 0){
                        ProjectTeiki::TeikiBurntPeriodically{
                          available: update_teiki.rewards,
                          last_burn_at: tx.time_range.start
                        }
                      } else {
                        error("Unsupported TeikiEmpty with burn_amount != 0")
                      }
                    },
                    teiki_burnt_periodically: TeikiBurntPeriodically => {
                      epochs: Int =
                        (tx.time_range.start - teiki_burnt_periodically.last_burn_at)
                          / pparams_datum.epoch_length;

                      if(epochs == 0){
                        if (update_teiki.burn_amount == 0) {
                          ProjectTeiki::TeikiBurntPeriodically{
                            available: teiki_burnt_periodically.available + update_teiki.rewards,
                            last_burn_at: teiki_burnt_periodically.last_burn_at
                          }
                        } else {
                          error("Unsupported TeikiEmpty with burn_amount != 0")
                        }
                      } else {
                        burn_rate_inv: Int = MULTIPLIER - pparams_datum.project_teiki_burn_rate;

                        remaining: Int =
                          calculate_teiki_remaining (
                            teiki_burnt_periodically.available,
                            burn_rate_inv,
                            epochs
                          );

                        if(update_teiki.burn_amount == teiki_burnt_periodically.available - remaining) {
                          ProjectTeiki::TeikiBurntPeriodically{
                            available: remaining + update_teiki.rewards,
                            last_burn_at: teiki_burnt_periodically.last_burn_at + epochs * pparams_datum.epoch_length
                          }
                        } else {
                          error("Wrong burn amount")
                        }
                      }
                    },
                    TeikiBurntEntirely => {
                      error("Cannot update in case of TeikiBurntEntirely")
                    }
                  };

                BurnActionResult {
                  new_project_teiki: new_project_teiki,
                  project_rewards: update_teiki.rewards
                }

              },
              BurnEntirely => {
                project_teiki_condition: Bool =
                  datum.project_teiki.switch {
                    TeikiEmpty => update_teiki.burn_amount == 0,
                    TeikiBurntEntirely => update_teiki.burn_amount == 0,
                    teiki_burnt_periodically: TeikiBurntPeriodically => {
                      teiki_burnt_periodically.available == update_teiki.burn_amount
                        && tx.ref_inputs.any(
                          (input: TxInput) -> Bool {
                            if (input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1){
                              input.output.datum.switch {
                                i: Inline => {
                                  project_datum: ProjectDatum = ProjectDatum::from_data(i.data);

                                  project_datum.project_id == datum.project_id
                                    && project_datum.status.switch {
                                      Delisted => true,
                                      else => false
                                    }
                                },
                                else => false
                              }
                            } else {
                              false
                            }
                          }
                        )
                    }
                  };

                if(project_teiki_condition) {
                  BurnActionResult {
                    new_project_teiki: ProjectTeiki::TeikiBurntEntirely,
                    project_rewards: 0
                  }
                } else {
                  error("Something went wrong with BurnEntirely action")
                }
              }
            };

          own_output_txout: TxOutput = tx.outputs_locked_by(own_validator_hash).head;
          own_output_datum: Datum =
            own_output_txout.datum.switch {
              i: Inline => Datum::from_data(i.data),
              else => error("Invalid Share treasury output UTxO: missing inline datum")
            };

          is_output_txout_valid: Bool =
            own_output_txout.address == own_input_txinput.output.address
              && own_output_txout.value.get_safe(AssetClass::ADA)
                  == own_input_txinput.output.value.get_safe(AssetClass::ADA)
              && own_output_txout.value.get_safe(TEIKI_ASSET_CLASS)
                  == own_input_txinput.output.value.get_safe(TEIKI_ASSET_CLASS)
                      + update_teiki.rewards
                      + burn_action_result.project_rewards
                      - update_teiki.burn_amount
              && own_output_datum.project_id == datum.project_id
              && own_output_datum.governor_teiki ==
                  datum.governor_teiki
                    + update_teiki.rewards * pparams_datum.governor_share_ratio / MULTIPLIER
              && own_output_datum.project_teiki ==
                  burn_action_result.new_project_teiki
              && own_output_datum.tag.switch {
                tag: TagContinuation => tag.former == own_input_txinput.output_id,
                else => false
              };

          own_validator_hash
            == pparams_datum.registry.shared_treasury_validator.latest
            && burn_amount_condition
            && is_output_txout_valid

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
