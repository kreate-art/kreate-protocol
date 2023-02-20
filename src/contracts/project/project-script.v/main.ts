import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  projectAtMph: Hex;
  protocolNftMph: Hex;
};

export default function main({ projectAtMph, protocolNftMph }: Params) {
  return helios`
    ${header("spending", "v__project_script")}

    import {
      ADA_MINTING_POLICY_HASH,
      ADA_TOKEN_NAME,
      RATIO_MULTIPLIER,
      TREASURY_UTXO_MIN_ADA,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_DETAIL_AT_TOKEN_NAME,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      PROJECT_SCRIPT_DELIST_DISCOUNT_CENTS,
      PROJECT_SCRIPT_CLOSE_DISCOUNT_CENTS
    } from ${module("constants")}

    import {
      script_hash_to_staking_credential,
      is_tx_authorized_by,
      find_pparams_datum_from_inputs,
      staking_credential_to_validator_hash
    } from ${module("helpers")}

    import { UserTag }
      from ${module("common__types")}

    import { Datum as ProjectDatum, ProjectStatus }
      from ${module("v__project__types")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import {
      Datum as OpenTreasuryDatum,
      Redeemer as OpenTreasuryRedeemer
    } from ${module("v__open_treasury__types")}

    import { Redeemer as ProjectAtRedeemer }
      from ${module("at__project__types")}

    import { Redeemer as ProjectDetailRedeemer }
      from ${module("v__project_detail__types")}

    import { Datum, Redeemer }
      from ${module("v__project_script__types")}

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

    func is_project_output(output: TxOutput) -> Bool {
      output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
    }

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      own_spending_output: TxOutput = ctx.get_current_input().output;
      own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      project_id: ByteArray = datum.project_id;

      redeemer.switch {

        Migrate => {
          migration_asset_class: AssetClass =
            pparams_datum.registry
              .project_script_validator
              .migrations
              .get(own_validator_hash);
          tx.minted.get_safe(migration_asset_class) != 0
        },

        else => {
          assert(
            own_validator_hash
              == pparams_datum.registry.project_script_validator.latest,
            "Wrong script version"
          );

          staking_script_hash: ScriptHash = own_spending_output.ref_script_hash.unwrap();

          staking_credential: StakingCredential =
            script_hash_to_staking_credential(staking_script_hash);

          staking_validator_hash: StakingValidatorHash =
            StakingValidatorHash::from_script_hash(staking_script_hash);

          project_output: TxOutput =
            tx.ref_inputs
              .map((input: TxInput) -> { input.output })
              .find_safe(is_project_output)
              .switch {
                None => tx.outputs.find(is_project_output),
                s: Some => s.some
              };

          project_datum: ProjectDatum =
            project_output.datum.switch {
              i: Inline => ProjectDatum::from_data(i.data),
              else => error("Invalid project UTxO: missing inline datum")
            };

          assert(
            project_datum.project_id == project_id,
            "Incorrect project UTxO"
          );

          project_at_purpose: ScriptPurpose =
            ScriptPurpose::new_minting(PROJECT_AT_MPH);

          project_at_redeemer: Data = tx.redeemers.get(project_at_purpose);

          assert(
            ProjectAtRedeemer::from_data(project_at_redeemer).switch {
              DeallocateStaking => true,
              else => false
            },
            "Burn project auth token with incorrect redeemer"
          );

          assert(
            tx.dcerts.any(
              (dcert: DCert) -> {
                dcert.switch {
                  deregister: Deregister => deregister.credential == staking_credential,
                  else => false
                }
              }
            ),
            "Deregister incorrect staking credential"
          );

          redeemer.switch {

            Close => {
              project_datum.status.switch {
                PreClosed => {
                  project_detail_input: TxInput =
                    tx.inputs.find(
                      (input: TxInput) -> {
                        input.output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                      }
                    );

                  project_detail_purpose: ScriptPurpose =
                    ScriptPurpose::new_spending(project_detail_input.output_id);

                  project_detail_redeemer: Data = tx.redeemers.get(project_detail_purpose);

                  assert(
                    ProjectDetailRedeemer::from_data(project_detail_redeemer).switch {
                      WithdrawFunds => true,
                      else => false
                    },
                    "Incorrect project detail redeemer"
                  )
                },
                Closed => {
                  withdrawn_rewards: Int =
                    tx.withdrawals.get(staking_credential);

                  if (withdrawn_rewards != 0) {
                    if (withdrawn_rewards < TREASURY_UTXO_MIN_ADA) {
                      open_treasury_input: TxInput =
                        tx.inputs.find(
                          (input: TxInput) -> Bool {
                            input.output.address.credential
                              == Credential::new_validator(
                                  pparams_datum.registry
                                    .open_treasury_validator
                                    .latest
                                )
                          }
                        );

                      open_treasury_purpose: ScriptPurpose =
                        ScriptPurpose::new_spending(open_treasury_input.output_id);

                      open_treasury_redeemer: Data =
                        tx.redeemers.get(open_treasury_purpose);

                      assert(
                        OpenTreasuryRedeemer::from_data(open_treasury_redeemer).switch {
                          collect: CollectDelayedStakingRewards => {
                            collect.staking_withdrawals.get(staking_validator_hash)
                              == withdrawn_rewards
                          },
                          else => false
                        },
                        "Incorrect open treasury redeemer"
                      )
                    } else {
                      treasurya_address: Address =
                        Address::new(
                          Credential::new_validator(
                            pparams_datum.registry
                              .open_treasury_validator
                              .latest
                          ),
                          Option[StakingCredential]::Some {
                            script_hash_to_staking_credential(
                              pparams_datum.registry.protocol_staking_validator
                            )
                          }
                        );
                      treasury_value: Value =
                        Value::lovelace(withdrawn_rewards);
                      governor_ada: Int =
                        withdrawn_rewards * pparams_datum.governor_share_ratio / RATIO_MULTIPLIER;

                      assert(
                        tx.outputs.any(
                          (output: TxOutput) -> {
                            output.address == treasurya_address
                              && output.value == treasury_value
                              && output.datum.switch {
                                i: Inline => {
                                  open_treasury_datum: OpenTreasuryDatum = OpenTreasuryDatum::from_data(i.data);
                                  open_treasury_datum.governor_ada == governor_ada
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
                        ),
                        "Must pay to open treasury"
                      )
                    }
                  }
                },
                else => error("Wrong project status")
              };

              if (is_tx_authorized_by(tx, project_datum.owner_address.credential)) {
                true
              } else {
                assert(
                  is_tx_authorized_by(tx, pparams_datum.staking_manager)
                    || is_tx_authorized_by(tx, pparams_datum.governor_address.credential),
                  "Must be authorized by owner or staking manager or governor"
                );

                owner_ada: Int =
                  datum.stake_key_deposit
                    - pparams_datum.discount_cent_price * PROJECT_SCRIPT_CLOSE_DISCOUNT_CENTS;

                owner_address: Address = project_datum.owner_address;

                tx.outputs.any(
                  (output: TxOutput) -> {
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
                            tag: TagProjectScriptClosed =>
                              tag.project_id == project_id
                                && tag.staking_validator == staking_validator_hash,
                            else => false
                          },
                        else => false
                      }
                  }
                )
              }
            },

            Delist => {
              assert(
                project_datum.status.switch {
                  Delisted => true,
                  else => false
                },
                "Project status must be delisted"
              );

              assert(
                is_tx_authorized_by(tx, pparams_datum.staking_manager)
                  || is_tx_authorized_by(tx, pparams_datum.governor_address.credential),
                "Must be authorized by staking manager or governor"
              );

              withdrawn_rewards: Int = tx.withdrawals.get(staking_credential);

              treasury_address: Address =
                Address::new(
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
                );

              ada_to_treasury: Int =
                own_spending_output.value.get(AssetClass::ADA)
                  + withdrawn_rewards
                  + datum.stake_key_deposit
                  - pparams_datum.discount_cent_price * PROJECT_SCRIPT_DELIST_DISCOUNT_CENTS;

              governor_share_ratio: Int =
                pparams_datum.governor_share_ratio;

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
                                  tag: TagProjectScriptDelisted =>
                                    tag.project_id == datum.project_id
                                      && tag.staking_validator == staking_validator_hash,
                                  else => false
                                }
                            && open_treasury_datum.governor_ada
                              == treasury_ada * governor_share_ratio / RATIO_MULTIPLIER
                        },
                        else => false
                      }
                  } else {
                    false
                  }
                }
              )
            },

            else => false

          }
        }
      }
    }
  `;
}
