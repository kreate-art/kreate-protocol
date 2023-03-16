import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  projectId: Hex;
  stakingSeed: string;
  projectAtMph: Hex;
  protocolNftMph: Hex;
};

// TODO: @sk-saru unused seed data
export default function main({
  projectId,
  stakingSeed,
  projectAtMph,
  protocolNftMph,
}: Params) {
  return helios`
    ${header("staking", "sv__project")}

    import {
      PROJECT_AT_TOKEN_NAME,
      PROJECT_DETAIL_AT_TOKEN_NAME,
      PROJECT_SCRIPT_AT_TOKEN_NAME
    } from ${module("constants")}

    import {
      script_hash_to_staking_credential,
      is_tx_authorized_by,
      find_pparams_datum_from_inputs
    } from ${module("helpers")}


    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import {
      Datum as ProjectDatum,
      Redeemer as ProjectRedeemer
    } from ${module("v__project__types")}

    import {
      Datum as ProjectDetailDatum,
      Redeemer as ProjectDetailRedeemer
    } from ${module("v__project_detail__types")}

    import { Redeemer as ProjectScriptRedeemer }
      from ${module("v__project_script__types")}

    const PROJECT_ID: ByteArray = #${projectId}
    const STAKING_SEED: ByteArray = #${stakingSeed}

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

    func main(_, ctx: ScriptContext) -> Bool{
      tx: Tx = ctx.tx;

      ctx.get_script_purpose().switch {

        rewarding: Rewarding => {
          tx.inputs.any(
            (input: TxInput) -> {
              output: TxOutput = input.output;

              case_active: Bool =
                output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                  && output.datum.switch {
                      i: Inline => ProjectDetailDatum::from_data(i.data).project_id == PROJECT_ID,
                      else => false
                    }
                  && ProjectDetailRedeemer::from_data(
                      tx.redeemers.get(
                        ScriptPurpose::new_spending(input.output_id)
                      )
                    ).switch {
                      WithdrawFunds => true,
                      else => false
                    };

              case_inactive: Bool =
                output.value.get_safe(PROJECT_SCRIPT_AT_ASSET_CLASS) == 1
                  && script_hash_to_staking_credential(output.ref_script_hash.unwrap())
                      == rewarding.credential;

              case_active || case_inactive
            }
          )
        },

        certifying: Certifying => {
          certifying.dcert.switch {

            // NOTE: This case is unreachable
            // We need this check to generate distinguish stake validators by STAKING_SEED
            Register => {
              STAKING_SEED == tx.inputs.head.serialize()
            },

            deregister: Deregister => {
              tx.inputs.any(
                (input: TxInput) -> {
                  output: TxOutput = input.output;
                  output.value.get_safe(PROJECT_SCRIPT_AT_ASSET_CLASS) == 1
                    && script_hash_to_staking_credential(output.ref_script_hash.unwrap())
                        == deregister.credential
                }
              )
            },

            Delegate => {
              pparams_datum: PParamsDatum =
                find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

              staking_manager_credential: Credential =
                pparams_datum.staking_manager;
              governor_credential: Credential =
                pparams_datum.governor_address.credential;

              check = (input: TxInput) -> Bool {
                output: TxOutput = input.output;
                if (output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1) {
                  project_datum: ProjectDatum =
                    output.datum.switch {
                      i: Inline => ProjectDatum::from_data(i.data),
                      else => error("Invalid project UTxO: missing inline datum")
                    };
                  project_datum.project_id == PROJECT_ID
                    && if (project_datum.is_staking_delegation_managed_by_protocol) {
                        is_tx_authorized_by(tx, staking_manager_credential)
                          || is_tx_authorized_by(tx, governor_credential)
                          || ProjectRedeemer::from_data(
                              tx.redeemers.get(ScriptPurpose::new_spending(input.output_id))
                            ).switch {
                              UpdateStakingDelegationManagement => true,
                              else => false
                            }
                      } else {
                        is_tx_authorized_by(tx, project_datum.owner_address.credential)
                      }
                } else {
                  false
                }
              };

              tx.ref_inputs.any(check) || tx.inputs.any(check)
            },

            else => false

          }
        },

        else => false

      }
    }
  `;
}
