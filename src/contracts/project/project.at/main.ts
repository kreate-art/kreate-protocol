import { helios } from "../../program";

export default function main(protocolNftMph: string) {
  return helios("at__project", [
    "at__project__types",
    "v__project__types",
    "v__project_detail__types",
    "v__project_script__types",
    "v__project__types",
    "v__protocol_params__types",
    "v__dedicated_treasury__types",
    "helpers",
    "constants",
  ])`
    minting at__project

    import { Redeemer } from at__project__types
    import { Redeemer as ProjectRedeemer } from v__project__types
    import { Datum as ProjectDetailDatum } from v__project_detail__types
    import { Datum as ProjectScriptDatum } from v__project_script__types
    import { Datum as ProjectDatum } from v__project__types
    import { Datum as PParamsDatum } from v__protocol_params__types
    import { Datum as DedicatedTreasuryDatum } from v__dedicated_treasury__types

    import {
      does_consume_input_with_output_id,
      find_tx_input_with_value,
      scriptHashToStakingCredential,
      is_tx_authorized_by,
      find_pparams_datum_from_inputs
    } from helpers

    import {
      ADA_MINTING_POLICY_HASH,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_DETAIL_AT_TOKEN_NAME,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      PROJECT_SCRIPT_UTXO_ADA,
      PROJECT_DETAIL_UTXO_ADA,
      MULTIPLIER
    } from constants

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func does_value_contain_only_one_token(
      value: Value,
      token_mph: MintingPolicyHash,
      token_name: ByteArray
    ) -> Bool {
      value.to_map().all(
        (mph: MintingPolicyHash, tokens: Map[ByteArray]Int) -> Bool {
          if (mph == ADA_MINTING_POLICY_HASH) { true }
          else if (mph == token_mph) { tokens == Map[ByteArray]Int {token_name: 1} }
          else { false }
        }
      )
    }

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      project_at_asset_class: AssetClass =
        AssetClass::new(own_mph, PROJECT_AT_TOKEN_NAME);
      project_script_at_asset_class: AssetClass =
        AssetClass::new(own_mph, PROJECT_SCRIPT_AT_TOKEN_NAME);
      project_script_at: Value = Value::new(project_script_at_asset_class, 1);

      redeemer.switch {
        new_project: NewProject => {
          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

          project_seed: TxOutputId = new_project.project_seed;
          project_id: ByteArray = project_seed.serialize().blake2b();

          does_mint_at_correctly: Bool =
            tx.minted.to_map().get(own_mph).all(
              (token_name: ByteArray, amount: Int) -> Bool {
                if (token_name == PROJECT_AT_TOKEN_NAME) { amount == 1 }
                else if (token_name == PROJECT_DETAIL_AT_TOKEN_NAME) { amount == 1 }
                else if (token_name == PROJECT_SCRIPT_AT_TOKEN_NAME) { amount == 1 }
                else {
                  false
                }
              }
            );

          project_script_txout: TxOutput =
            tx.outputs.find (
              (output: TxOutput) -> Bool {
                output.ref_script_hash.switch {
                  None => false,
                  else => {
                    staking_validator: StakingCredential =
                      scriptHashToStakingCredential(output.ref_script_hash.unwrap());

                    output.address
                      == Address::new(
                          Credential::new_validator(
                              pparams_datum.registry
                                .project_script_validator
                                .latest
                          ),
                          Option[StakingCredential]::Some{staking_validator}
                        )
                      && does_value_contain_only_one_token(
                          output.value, own_mph,
                          PROJECT_SCRIPT_AT_TOKEN_NAME
                      )
                      && output.datum.switch {
                        i: Inline =>
                          project_script_datum: ProjectScriptDatum =
                            ProjectScriptDatum::from_data(i.data);

                          project_script_datum.project_id == project_id
                            && project_script_datum.stake_key_deposit
                                == pparams_datum.stake_key_deposit,
                        else => false
                      }
                  }
                }
              }
            );

          staking_validator: StakingCredential
            = scriptHashToStakingCredential(project_script_txout.ref_script_hash.unwrap());

          project_detail_txout: TxOutput =
            tx.outputs.find (
              (output: TxOutput) -> Bool {
                output.address
                  == Address::new (
                      Credential::new_validator(
                        pparams_datum.registry.project_detail_validator.latest
                      ),
                      Option[StakingCredential]::Some{staking_validator}
                    )
              }
            );

          project_detail_datum: ProjectDetailDatum =
            project_detail_txout.datum.switch {
              i: Inline => ProjectDetailDatum::from_data(i.data),
              else => error("Invalid project detail UTxO: missing inline datum")
            };

          does_produce_project_detail_correctly: Bool =
            does_value_contain_only_one_token(
              project_detail_txout.value,
              own_mph,
              PROJECT_DETAIL_AT_TOKEN_NAME
            )
              && project_detail_txout.value.get_safe(AssetClass::ADA) == PROJECT_DETAIL_UTXO_ADA
              && project_detail_datum.project_id == project_id
              && project_detail_datum.withdrawn_funds == 0
              && project_detail_datum.information_cid != ""
              && project_detail_datum.last_community_update_cid == Option[String]::None
              && project_detail_datum.sponsored_until.switch {
                None => true,
                s: Some => s.some == tx.time_range.start + pparams_datum.project_sponsorship_duration
              };

          does_produce_exactly_one_project: Bool =
            tx.outputs.any(
              (output: TxOutput) -> Bool {
                output.address
                  == Address::new(
                      Credential::new_validator(
                        pparams_datum.registry.project_validator.latest
                      ),
                      Option[StakingCredential]::Some{staking_validator}
                    )
                  && does_value_contain_only_one_token(
                    output.value,
                    own_mph,
                    PROJECT_AT_TOKEN_NAME
                  )
                  && output.value.get_safe(AssetClass::ADA)
                      == pparams_datum.project_pledge
                          - pparams_datum.stake_key_deposit
                          - PROJECT_DETAIL_UTXO_ADA
                          - PROJECT_SCRIPT_UTXO_ADA
                  && output.datum.switch {
                    i: Inline => {
                      project_datum: ProjectDatum = ProjectDatum::from_data(i.data);

                      project_datum.project_id == project_id
                        && (
                          is_tx_authorized_by(tx, project_datum.owner_address.credential)
                            || is_tx_authorized_by(tx, pparams_datum.governor_address.credential)
                          )
                        && project_datum.milestone_reached == 0
                        && project_datum.is_staking_delegation_managed_by_protocol
                    },
                    else => false
                  }
              }
            );

          min_total_fees: Int =
            pparams_datum.project_creation_fee
              + if (project_detail_datum.sponsored_until != Option[Time]::None){
                  pparams_datum.project_sponsorship_fee
                } else {
                  0
                };

          does_produce_exactly_one_treasury: Bool =
            tx.outputs.any(
              (output: TxOutput) -> Bool {
                output.address
                  == Address::new(
                    Credential::new_validator(
                      pparams_datum.registry.dedicated_treasury_validator.latest
                    ),
                    Option[StakingCredential]::Some{
                      scriptHashToStakingCredential(
                        pparams_datum.registry.protocol_staking_validator
                      )
                    }
                  )
                  && output.value.to_map().length == 1
                  && output.value.get_safe(AssetClass::ADA) >= min_total_fees
                  && output.datum.switch {
                    i: Inline => {
                      dedicated_treasury_datum: DedicatedTreasuryDatum =
                        DedicatedTreasuryDatum::from_data(i.data);

                      dedicated_treasury_datum.governor_ada ==
                        output.value.get_safe(AssetClass::ADA) * pparams_datum.governor_share_ratio / MULTIPLIER
                        && dedicated_treasury_datum.project_id == project_id
                        && dedicated_treasury_datum.tag.switch {
                          tag: TagOriginated => tag.seed == project_seed,
                          else => false
                        }
                    },
                    else => false
                  }
              }
          );

          does_register_staking_validator_correctly: Bool =
            tx.dcerts
              .any(
                (dcert: DCert) -> Bool {
                  dcert.switch {
                    register: Register => register.credential == staking_validator,
                    else => false
                  }
                }
              );

          does_consume_input_with_output_id(tx, project_seed)
            && does_mint_at_correctly
            && does_produce_project_detail_correctly
            && does_produce_exactly_one_project
            && does_produce_exactly_one_treasury
            && does_register_staking_validator_correctly
        },
        AllocateStaking => {
          consumed_project_output_ids: []TxOutputId =
            tx.inputs
              .filter (
                (input: TxInput) -> Bool {
                  input.output.value.get_safe(project_at_asset_class) == 1
                }
              )
              .map(
                (input: TxInput) -> TxOutputId {input.output_id}
              );

          num_consumed_satisfied_project_output: Int =
            tx.redeemers
              .filter (
                (script_purpose: ScriptPurpose, data: Data) -> Bool {
                  script_purpose.switch {
                    spending: Spending => {
                      ProjectRedeemer::from_data(data).switch {
                        AllocateStakingValidator =>
                          consumed_project_output_ids.any (
                            (output_id: TxOutputId) -> Bool {
                              output_id == spending.output_id
                            }
                          ),
                        else => false
                      }
                    },
                    else => false
                  }
                }
              )
              .length;

          tx.minted.to_map().get(own_mph).all(
            (token_name: ByteArray, amount: Int) -> Bool {
              if (token_name == PROJECT_SCRIPT_AT_TOKEN_NAME) { amount == num_consumed_satisfied_project_output }
              else { false }
            }
          )
            && tx.inputs.all(
              (input: TxInput) -> Bool {
                input.output.value.get_safe(project_script_at_asset_class) == 0
              }
            )
        },
        DeallocateStaking => {
          tx.outputs.all(
            (output: TxOutput) -> Bool {
              !output.value.contains(project_script_at)
            }
          ) && tx.minted <= Value::new(project_script_at_asset_class, 0 - 1)
        },
        Migrate => {
          tx.outputs.all(
            (output: TxOutput) -> Bool {
              output.value.get_policy(own_mph).length == 0
            }
          )
        }
      }
    }
  `;
}
