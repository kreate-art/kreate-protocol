import { Hex } from "@/types";

import { header, helios, HeliosScript, module } from "../../program";

export type Params = {
  protocolNftMph: Hex;
};

export default function main({ protocolNftMph }: Params): HeliosScript {
  return helios`
    ${header("staking", "sv__protocol")}

    import { RATIO_MULTIPLIER }
      from ${module("constants")}

    import {
      is_tx_authorized_by,
      find_pparams_datum_from_inputs,
      find_pparams_datum_from_outputs,
      stakingCredentialToSVH,
      scriptHashToStakingCredential
    } from ${module("helpers")}

    import { Datum as OpenTreasuryDatum }
      from ${module("v__open_treasury__types")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      ctx.get_script_purpose().switch {

        rewarding: Rewarding => {
          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

          own_staking_credential: StakingCredential = rewarding.credential;

          withdrawn_amount: Int = tx.withdrawals.get(own_staking_credential);

          governor_share_amount: Int =
            withdrawn_amount * pparams_datum.governor_share_ratio / RATIO_MULTIPLIER;

          open_treasury_address: Address = Address::new(
            Credential::new_validator(
              pparams_datum.registry.open_treasury_validator.latest
            ),
            Option[StakingCredential]::Some {
              scriptHashToStakingCredential(
                pparams_datum.registry.protocol_staking_validator
              )
            }
          );

          open_treasury_output: TxOutput =
            tx.outputs.find(
              (output: TxOutput) -> {
                output.address == open_treasury_address
                  && output.value.to_map().length == 1
                  && output.value.get(AssetClass::ADA) >= withdrawn_amount
              }
            );

          open_treasury_datum: OpenTreasuryDatum =
            open_treasury_output.datum
              .switch {
                i: Inline => OpenTreasuryDatum::from_data(i.data),
                else => error("Invalid open treasury utxo: must inline datum")
              };

          open_treasury_datum.governor_ada == governor_share_amount
            && open_treasury_datum.tag.switch {
              tag: TagProtocolStakingRewards => {
                tag.staking_validator == stakingCredentialToSVH(own_staking_credential)
              },
              else => false
            }
        },

        certifying: Certifying => {
          pparams_datum: PParamsDatum =
            find_pparams_datum_from_outputs(
              tx.ref_inputs.map((input: TxInput) -> { input.output })
                + tx.outputs,
              PROTOCOL_NFT_MPH
            );

          is_authorized: Bool =
            is_tx_authorized_by(tx, pparams_datum.staking_manager)
              || is_tx_authorized_by(tx, pparams_datum.governor_address.credential);

          certifying.dcert.switch {
            Register => error("unreachable"),
            Deregister => is_authorized,
            Delegate => is_authorized,
            else => false
          }
        },

        else => false
      }
    }
  `;
}
