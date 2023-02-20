import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  protocolNftMph: Hex;
};

export default function main({ protocolNftMph }: Params) {
  return helios`
    ${header("minting", "at__project")}

    import {
      ADA_MINTING_POLICY_HASH,
      ADA_TOKEN_NAME,
      PROJECT_AT_MIGRATE_IN,
      PROJECT_AT_TOKEN_NAME,
      PROJECT_DETAIL_AT_TOKEN_NAME,
      PROJECT_DETAIL_UTXO_ADA,
      PROJECT_SCRIPT_AT_TOKEN_NAME,
      PROJECT_SCRIPT_UTXO_ADA,
      RATIO_MULTIPLIER
    } from ${module("constants")}

    import {
      find_pparams_datum_from_inputs,
      is_tx_authorized_by,
      script_hash_to_staking_credential
    } from ${module("helpers")}

    import { TreasuryTag }
      from ${module("common__types")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import { Datum as DedicatedTreasuryDatum }
      from ${module("v__dedicated_treasury__types")}

    import { Datum as ProjectDetailDatum, Sponsorship }
      from ${module("v__project_detail__types")}

    import { Datum as ProjectScriptDatum }
      from ${module("v__project_script__types")}

    import { Datum as ProjectDatum, Redeemer as ProjectRedeemer }
      from ${module("v__project__types")}

    import { Redeemer }
      from ${module("at__project__types")}

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      redeemer.switch {

        new_project: NewProject => {
          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

          project_seed: TxOutputId = new_project.project_seed;
          project_id: ByteArray = project_seed.serialize().blake2b();

          does_mint_correctly: Bool =
            tx.minted.get_policy(own_mph).all(
              (token_name: ByteArray, amount: Int) -> {
                if (token_name == PROJECT_AT_TOKEN_NAME) { amount == 1 }
                else if (token_name == PROJECT_DETAIL_AT_TOKEN_NAME) { amount == 1 }
                else if (token_name == PROJECT_SCRIPT_AT_TOKEN_NAME) { amount == 1 }
                else { false }
              }
            );

          project_script_value: Value =
            Value::from_map(
              Map[MintingPolicyHash]Map[ByteArray]Int {
                ADA_MINTING_POLICY_HASH: Map[ByteArray]Int { ADA_TOKEN_NAME: PROJECT_SCRIPT_UTXO_ADA },
                own_mph: Map[ByteArray]Int { PROJECT_SCRIPT_AT_TOKEN_NAME: 1 }
              }
            );
          project_script_credential: Credential =
            Credential::new_validator(
              pparams_datum.registry.project_script_validator.latest
            );
          project_script_datum: ProjectScriptDatum =
            ProjectScriptDatum {
              project_id: project_id,
              stake_key_deposit: pparams_datum.stake_key_deposit
            };
          project_script_output: TxOutput =
            tx.outputs.find(
              (output: TxOutput) -> {
                output.ref_script_hash.switch {
                  s: Some => {
                    staking_credential: StakingCredential =
                      script_hash_to_staking_credential(s.some);
                    project_script_address: Address =
                      Address::new(
                        project_script_credential,
                        Option[StakingCredential]::Some { staking_credential }
                      );
                    output.value == project_script_value
                      && output.address == project_script_address
                      && output.datum.switch {
                        i: Inline => ProjectScriptDatum::from_data(i.data) == project_script_datum,
                        else => false
                      }
                  },
                  None => false
                }
              }
            );

          staking_credential: StakingCredential =
            script_hash_to_staking_credential(project_script_output.ref_script_hash.unwrap());

          project_detail_value: Value =
            Value::from_map(
              Map[MintingPolicyHash]Map[ByteArray]Int {
                ADA_MINTING_POLICY_HASH: Map[ByteArray]Int { ADA_TOKEN_NAME: PROJECT_DETAIL_UTXO_ADA },
                own_mph: Map[ByteArray]Int { PROJECT_DETAIL_AT_TOKEN_NAME: 1 }
              }
            );
          project_detail_address: Address =
            Address::new(
              Credential::new_validator(
                pparams_datum.registry.project_detail_validator.latest
              ),
              Option[StakingCredential]::Some { staking_credential }
            );
          project_sponsorship_min_fee: Int =
            pparams_datum.project_sponsorship_min_fee;
          project_sponsorship_duration: Duration =
            pparams_datum.project_sponsorship_duration;
          project_detail_output: TxOutput =
            tx.outputs.find(
              (output: TxOutput) -> {
                output.value == project_detail_value
                  && output.address == project_detail_address
                  && output.datum.switch {
                    i: Inline => {
                      project_detail_datum: ProjectDetailDatum =
                        ProjectDetailDatum::from_data(i.data);
                      project_detail_datum.project_id == project_id
                        && project_detail_datum.withdrawn_funds == 0
                        && project_detail_datum.information_cid != ""
                        && project_detail_datum.last_announcement_cid == Option[String]::None
                        && project_detail_datum.sponsorship.switch {
                          None => true,
                          s: Some => {
                            sp: Sponsorship = s.some;
                            sp.amount >= project_sponsorship_min_fee
                              && sp.until == tx.time_range.start + project_sponsorship_duration
                          }
                        }
                    },
                    else => false
                  }
              }
            );

          project_value: Value =
            Value::from_map(
              Map[MintingPolicyHash]Map[ByteArray]Int {
                ADA_MINTING_POLICY_HASH: Map[ByteArray]Int {
                  ADA_TOKEN_NAME: (
                    pparams_datum.project_pledge
                      - pparams_datum.stake_key_deposit
                      - PROJECT_DETAIL_UTXO_ADA
                      - PROJECT_SCRIPT_UTXO_ADA
                  )
                },
                own_mph: Map[ByteArray]Int { PROJECT_AT_TOKEN_NAME: 1 }
              }
            );
          project_address: Address =
            Address::new(
              Credential::new_validator(
                pparams_datum.registry.project_validator.latest
              ),
              Option[StakingCredential]::Some { staking_credential }
            );
          governor_address_credential: Credential =
            pparams_datum.governor_address.credential;
          does_produce_project_correctly: Bool =
            tx.outputs.any(
              (output: TxOutput) -> {
                output.value == project_value
                  && output.address == project_address
                  && output.datum.switch {
                    i: Inline => {
                      project_datum: ProjectDatum = ProjectDatum::from_data(i.data);
                      project_datum.project_id == project_id
                        && project_datum.milestone_reached == 0
                        && project_datum.is_staking_delegation_managed_by_protocol
                        && (
                          is_tx_authorized_by(tx, project_datum.owner_address.credential)
                            || is_tx_authorized_by(tx, governor_address_credential)
                          )
                    },
                    else => false
                  }
              }
            );

          sponsorship_fee: Int =
            project_detail_output.datum.switch {
              i: Inline => {
                ProjectDetailDatum::from_data(i.data).sponsorship.switch {
                  s: Some => s.some.amount,
                  None => 0
                }
              },
              else => error("Invalid project detail UTxO: missing inline datum")
            };
          total_fees: Int = pparams_datum.project_creation_fee + sponsorship_fee;
          governor_ada: Int = total_fees * pparams_datum.governor_share_ratio / RATIO_MULTIPLIER;

          treasury_value: Value = Value::lovelace(total_fees);
          treasury_address: Address =
            Address::new(
              Credential::new_validator(
                pparams_datum.registry.dedicated_treasury_validator.latest
              ),
              Option[StakingCredential]::Some{
                script_hash_to_staking_credential(
                  pparams_datum.registry.protocol_staking_validator
                )
              }
            );
          treasury_datum: DedicatedTreasuryDatum =
            DedicatedTreasuryDatum {
              project_id: project_id,
              governor_ada: governor_ada,
              tag: TreasuryTag::TagOriginated {seed: project_seed}
            };
          does_produce_treasury_correctly: Bool =
            tx.outputs.any(
              (output: TxOutput) -> {
                output.value == treasury_value
                  && output.address == treasury_address
                  && output.datum.switch {
                    i: Inline => DedicatedTreasuryDatum::from_data(i.data) == treasury_datum,
                    else => false
                  }
              }
          );

          does_register_staking_validator_correctly: Bool =
            tx.dcerts.any(
              (dcert: DCert) -> {
                dcert.switch {
                  register: Register => register.credential == staking_credential,
                  else => false
                }
              }
            );

          tx.inputs.any((input: TxInput) -> { input.output_id == project_seed })
            && does_mint_correctly
            && does_produce_project_correctly
            && does_produce_treasury_correctly
            && does_register_staking_validator_correctly
        },

        AllocateStaking => {
          project_at_asset_class: AssetClass =
            AssetClass::new(own_mph, PROJECT_AT_TOKEN_NAME);

          project_script_at_asset_class: AssetClass =
            AssetClass::new(own_mph, PROJECT_SCRIPT_AT_TOKEN_NAME);

          redeemers: Map[ScriptPurpose]Data = tx.redeemers;
          num_consumed_project_output: Int =
            tx.inputs
              .fold(
                (acc: Int, input: TxInput) -> {
                  if (input.output.value.get_safe(project_at_asset_class) == 1) {
                    project_purpose: ScriptPurpose =
                      ScriptPurpose::new_spending(input.output_id);
                    project_redeemer: Data =
                      redeemers.get(project_purpose);
                    ProjectRedeemer::from_data(project_redeemer).switch {
                      AllocateStakingValidator => acc + 1,
                      else => acc
                    }
                  } else {
                    acc
                  }
                },
                0
              );

          are_tokens_not_in_inputs: Bool = tx.inputs.all(
            (input: TxInput) -> {
              input.output.value.get_safe(project_script_at_asset_class) == 0
            }
          );

          are_tokens_minted_correctly: Bool = tx.minted.get_policy(own_mph).all(
            (token_name: ByteArray, amount: Int) -> {
              if (token_name == PROJECT_SCRIPT_AT_TOKEN_NAME) { amount == num_consumed_project_output }
              else { false }
            }
          );

          are_tokens_not_in_inputs && are_tokens_minted_correctly
        },

        DeallocateStaking => {
          project_script_at_asset_class: AssetClass =
            AssetClass::new(own_mph, PROJECT_SCRIPT_AT_TOKEN_NAME);

          are_tokens_not_in_outputs: Bool = tx.outputs.all(
            (output: TxOutput) -> {
              output.value.get_safe(project_script_at_asset_class) == 0
            }
          );

          are_tokens_burnt: Bool = tx.minted.get_policy(own_mph).all(
            (token_name: ByteArray, amount: Int) -> {
              if (token_name == PROJECT_SCRIPT_AT_TOKEN_NAME) { amount < 0 }
              else { false }
            }
          );

          are_tokens_not_in_outputs && are_tokens_burnt
        },

        MigrateOut => {
          !tx.outputs.any(
            (output: TxOutput) -> {
              output.value.contains_policy(own_mph)
            }
          )
        },

        MigrateIn => {
          PROJECT_AT_MIGRATE_IN.switch {
            None => error("No PROJECT_AT_MIGRATE_IN"),
            s: Some => tx.minted.contains_policy(s.some)
          }
        }
      }
    }
  `;
}
