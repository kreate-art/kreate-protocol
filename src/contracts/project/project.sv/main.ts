import { Hex } from "@/types";

import { helios } from "../../program";

export type ProjectStakeParams = {
  projectId: Hex;
  _stakingSeed: string;
  projectAtMph: Hex;
  protocolNftMph: Hex;
};

// TODO: @sk-saru unused seed data
export default function main({
  projectId,
  _stakingSeed,
  projectAtMph,
  protocolNftMph,
}: ProjectStakeParams) {
  return helios("sv__project", [
    "v__project_detail__types",
    "v__project__types",
    "v__protocol_params__types",
    "v__project_detail__types",
    "v__project_script__types",
    "helpers",
    "constants",
  ])`
    staking sv__project

    import { Datum as ProjectDetailDatum } from v__project_detail__types
    import {
      Datum as ProjectDatum,
      Redeemer as ProjectRedeemer
    } from v__project__types
    import { Datum as PParamsDatum } from v__protocol_params__types
    import { Redeemer as ProjectDetailRedeemer } from v__project_detail__types
    import { Redeemer as ProjectScriptRedeemer } from v__project_script__types

    import {
      scriptHashToStakingCredential,
      is_tx_authorized_by,
      find_pparams_datum_from_inputs
    } from helpers

    import {
      PROJECT_AT_TOKEN_NAME,
      PROJECT_DETAIL_AT_TOKEN_NAME,
      PROJECT_SCRIPT_AT_TOKEN_NAME
    } from constants

    const project_id: ByteArray = #${projectId}

    const PROJECTS_AT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${projectAtMph})

    const PROJECT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_AT_TOKEN_NAME)

    const PROJECT_DETAIL_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_DETAIL_AT_TOKEN_NAME)

    const PROJECT_SCRIPT_AT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROJECTS_AT_MPH, PROJECT_SCRIPT_AT_TOKEN_NAME)

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(ctx: ScriptContext) -> Bool{
      tx: Tx = ctx.tx;

      ctx.get_script_purpose().switch {
        rewarding:Rewarding => {
          project_detail_option_input: Option[TxInput] =
            tx.inputs.find_safe(
              (input: TxInput) -> Bool {
                input.output.value.get_safe(PROJECT_DETAIL_AT_ASSET_CLASS) == 1
                  && input.output.datum
                      .switch {
                        i: Inline => ProjectDetailDatum::from_data(i.data).project_id == project_id,
                        else => false
                      }
              }
            );

          // NOTE: check the behavior
          project_script_option_input: Option[TxInput] =
            tx.inputs.find_safe(
              (input: TxInput) -> Bool {
                input.output.value.get_safe(PROJECT_SCRIPT_AT_ASSET_CLASS) == 1
                  && scriptHashToStakingCredential(input.output.ref_script_hash.unwrap())
                      == rewarding.credential
              }
            );

          case_active: Bool =
            project_detail_option_input.switch{
              None => false,
              else => {
                project_detail_input: TxInput = project_detail_option_input.unwrap();

                project_detail_script_purpose: ScriptPurpose =
                  ScriptPurpose::new_spending(project_detail_input.output_id);

                project_detail_redeemer_data: Data =
                  tx.redeemers.get(project_detail_script_purpose);

                ProjectDetailRedeemer::from_data(project_detail_redeemer_data).switch {
                  WithdrawFunds => true,
                  else => false
                }
              }
            };

          case_inactive: Bool =
            project_script_option_input.switch {
              None => false,
              else => {
                project_script_input: TxInput = project_script_option_input.unwrap();

                project_script_purpose: ScriptPurpose =
                  ScriptPurpose::new_spending(project_script_input.output_id);

                project_script_redeemer_data: Data = tx.redeemers.get(project_script_purpose);

                // redundant check
                ProjectScriptRedeemer::from_data(project_script_redeemer_data).switch {
                  Close => true,
                  Delist => true,
                  Migrate => true
                }
              }
            };

          case_active || case_inactive
        },
        certifying: Certifying => {
          certifying.dcert
            .switch {
              deregister: Deregister => {
                project_script_input: TxInput =
                  tx.inputs.find(
                    (input: TxInput) -> Bool {
                      input.output.value.get_safe(PROJECT_SCRIPT_AT_ASSET_CLASS) == 1
                        && scriptHashToStakingCredential(input.output.ref_script_hash.unwrap())
                            == deregister.credential
                    }
                  );

                project_script_purpose: ScriptPurpose =
                  ScriptPurpose::new_spending(project_script_input.output_id);

                project_script_redeemer_data: Data = tx.redeemers.get(project_script_purpose);

                // redundant check
                ProjectScriptRedeemer::from_data(project_script_redeemer_data).switch {
                  Close => true,
                  Delist => true,
                  Migrate => true
                }
              },
              Delegate => {
                project_input: TxInput =
                  (tx.inputs + tx.ref_inputs)
                    .find(
                      (input: TxInput) -> Bool {
                        input.output.value.get_safe(PROJECT_AT_ASSET_CLASS) == 1
                      }
                    );

                project_datum: ProjectDatum =
                  project_input.output.datum.switch {
                    i: Inline => ProjectDatum::from_data(i.data),
                    else => error("Invalid Project utxo: missing inline datum")
                  };

                pparams_datum: PParamsDatum =
                  find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

                project_datum.project_id == project_id
                  && if (project_datum.is_staking_delegation_managed_by_protocol){
                    if (
                      is_tx_authorized_by(tx, pparams_datum.governor_address.credential)
                        || is_tx_authorized_by(tx, pparams_datum.staking_manager)
                    ) {
                      true
                    } else {
                      project_purpose: ScriptPurpose =
                        ScriptPurpose::new_spending(project_input.output_id);

                      project_redeemer_data: Data = tx.redeemers.get(project_purpose);

                      ProjectRedeemer::from_data(project_redeemer_data).switch {
                        UpdateStakingDelegationManagement => true,
                        else => false
                      }
                    }
                  } else {
                    is_tx_authorized_by(tx, project_datum.owner_address.credential)
                  }
              },
              else => false
            }
        },
        else => false
      }
    }
  `;
}
