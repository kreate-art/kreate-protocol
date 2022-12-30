import { helios } from "../../program";

export type ProjectScriptParams = {
  projectsAuthTokenMPH: string;
  protocolNftMPH: string;
};

export function getProjectScriptSource({
  projectsAuthTokenMPH,
  protocolNftMPH,
}: ProjectScriptParams) {
  return helios`
    spending project_script

    import { Datum, Redeemer } from project_script_types
    import { Datum as ProjectDatum, ProjectStatus } from project_validator_types
    import { Datum as PParamsDatum } from protocol_params_types
    import {
      Datum as OpenTreasuryDatum,
      Redeemer as OpenTreasuryRedeemer
    } from open_treasury_types
    import { UserTag } from common__types

    import {
      scriptHashToStakingCredential,
      is_tx_authorized_by,
      find_pparams_datum_from_inputs,
      stakingCredentialToSVH
    } from helpers

    import {
      MULTIPLIER,
      TREASURY_UTXO_MIN_ADA,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      PROJECT_SCRIPT_DELIST_DISCOUNT_CENTS,
      PROJECT_SCRIPT_CLOSE_DISCOUNT_CENTS
    } from constants

    const PROJECTS_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectsAuthTokenMPH})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_SCRIPT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_SCRIPT_AT_TOKEN_NAME)

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMPH})

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      own_input_txout: TxOutput = ctx.get_current_input().output;
      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      redeemer.switch {
        Migrate => {
          migration_asset_class: AssetClass =
            pparams_datum
              .registry
              .project_script_validator
              .migrations
              .get(own_validator_hash);

          tx.minted.get_safe(migration_asset_class) != 0
        },
        else => {
          staking_script_hash: ScriptHash = own_input_txout.ref_script_hash.unwrap();
          staking_credential: StakingCredential =
            scriptHashToStakingCredential(staking_script_hash);

          staking_validator_hash: StakingValidatorHash =
            StakingValidatorHash::from_script_hash(staking_script_hash);

          project_txout: TxOutput =
            (tx.ref_inputs + tx.inputs)
              .find(
                (input: TxInput) -> Bool {
                  input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                }
              )
              .output;

          project_datum: ProjectDatum =
            project_txout.datum.switch {
              i: Inline => ProjectDatum::from_data(i.data),
              else => error("Invalid Project utxo: missing inline datum")
            };

          withdrawn_rewards: Int = tx.withdrawals.get(staking_credential);

          assert (
            own_validator_hash
              == pparams_datum.registry.project_script_validator.latest,
            "Wrong script version"
          );

          tx.minted.get(PROJECT_SCRIPT_AT_ASSET_CLASS) <= 0 - 1
            && tx.dcerts.any(
              (dcert: DCert) -> Bool {
                dcert.switch {
                  deregister: Deregister => deregister.credential == staking_credential,
                  else => false
                }
              }
            )
            && project_datum.project_id == datum.project_id
            && redeemer.switch {
              Close => {
                is_delayed_staking: Bool =
                  project_datum.status.switch {
                    Closed => true,
                    PreClosed => false,
                    else => error("Wrong project status")
                  };

                withdrawn_rewards_to_owner: Int =
                  if (is_delayed_staking) {
                    delay_staking_condition: Bool =
                      if (withdrawn_rewards == 0) {
                        true
                      } else if (withdrawn_rewards < TREASURY_UTXO_MIN_ADA) {
                        open_treasury_input: TxInput =
                          tx.inputs.find(
                            (input: TxInput) -> Bool {
                              input.output.address.credential
                                == Credential::new_validator (
                                    pparams_datum.registry
                                      .open_treasury_validator
                                      .latest
                                  )
                            }
                          );

                        open_treasury_script_purpose: ScriptPurpose =
                          ScriptPurpose::new_spending(open_treasury_input.output_id);

                        open_treasury_redeemer_data: Data =
                          tx.redeemers.get(open_treasury_script_purpose);

                        OpenTreasuryRedeemer::from_data(open_treasury_redeemer_data).switch {
                          collect: CollectDelayedStakingRewards => {
                            collect.staking_withdrawals.get(staking_validator_hash)
                              == withdrawn_rewards
                          },
                          else => false
                        }

                      } else {
                        tx.outputs.any(
                          (output: TxOutput) -> Bool {
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
                              && output.value == Value::lovelace(withdrawn_rewards)
                              && output.datum.switch {
                                i: Inline => {
                                  open_treasury_datum: OpenTreasuryDatum = OpenTreasuryDatum::from_data(i.data);

                                  open_treasury_datum.governor_ada
                                      == withdrawn_rewards * pparams_datum.governor_share_ratio / MULTIPLIER
                                    && open_treasury_datum.tag.switch {
                                      tag: TagProjectDelayedStakingRewards => {
                                        tag.staking_validator.unwrap() == staking_validator_hash
                                      },
                                      else => false
                                    }
                                },
                                else => false
                              }
                          }
                        )
                      };

                    if (delay_staking_condition) {
                      0
                    } else {
                      error("Invalid Open treasury UTxO")
                    }
                  } else {
                    withdrawn_rewards
                  };

                if(is_tx_authorized_by(tx, project_datum.owner_address.credential)){
                  true
                } else {
                  is_tx_authorized_by(tx, pparams_datum.governor_address.credential)
                    && tx.outputs.any(
                      (output: TxOutput) -> Bool {
                        output.address == project_datum.owner_address
                          && output.value >=
                              own_input_txout.value
                                + Value::lovelace(
                                    datum.stake_key_deposit
                                    + withdrawn_rewards_to_owner
                                    - pparams_datum.discount_cent_price * PROJECT_SCRIPT_CLOSE_DISCOUNT_CENTS
                                  )
                          && output.datum.switch {
                            i: Inline =>
                              UserTag::from_data(i.data).switch {
                                tag: TagProjectScriptClosed =>
                                  tag.project_id == datum.project_id
                                    && tag.staking_validator == stakingCredentialToSVH(staking_credential),
                                  else => false
                              },
                            else => false
                          }
                      }
                    )
                }

              },
              Delist => {
                is_output_project_datum_valid: Bool =
                  project_datum.status.switch {
                    Delisted => true,
                    else => false
                  };

                treasury_ada: Int =
                  own_input_txout.value.get_safe(AssetClass::ADA)
                    + withdrawn_rewards
                    + datum.stake_key_deposit
                    - pparams_datum.discount_cent_price * PROJECT_SCRIPT_DELIST_DISCOUNT_CENTS;

                is_treasury_txout_valid: Bool =
                  tx.outputs.any(
                    (output: TxOutput) -> Bool {
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
                        && output.value.get(AssetClass::ADA) >= treasury_ada
                        && output.datum.switch {
                          i: Inline => {
                            open_treasury_datum: OpenTreasuryDatum = OpenTreasuryDatum::from_data(i.data);

                            open_treasury_datum.governor_ada
                                == output.value.get(AssetClass::ADA)
                                    * pparams_datum.governor_share_ratio / MULTIPLIER
                              && open_treasury_datum.tag.switch {
                                    tag: TagProjectScriptDelisted =>
                                      tag.project_id == datum.project_id
                                        && tag.staking_validator == staking_validator_hash,
                                    else => false
                                  }
                          },
                          else => false
                        }
                    }
                  );

                is_tx_authorized_by(tx, pparams_datum.governor_address.credential)
                  && is_output_project_datum_valid
                  && is_treasury_txout_valid
              },
              else => {
                false
              }
            }
        }
      }
    }
  `;
}