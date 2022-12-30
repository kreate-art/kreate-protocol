import { helios, HeliosSource } from "../../program";

export default function main(protocolNftMph: string): HeliosSource {
  return helios`
    staking sv__protocol

    import { MULTIPLIER } from constants
    import { Datum as OpenTreasuryDatum } from v__open_treasury__types
    import { Datum as PParamsDatum } from v__protocol_params__types

    import {
      find_pparams_datum_from_inputs,
      find_pparams_datum_from_outputs,
      stakingCredentialToSVH,
      is_tx_authorized_by
    } from helpers

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      ctx.get_script_purpose().switch {
        rewarding: Rewarding => {
          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

          own_staking_credential: StakingCredential = rewarding.credential;

          withdraw_amount: Int = tx.withdrawals.get(own_staking_credential);

          open_treasury_address: Address = Address::new(
            Credential::new_validator(
              pparams_datum.registry.open_treasury_validator.latest
            ),
            Option[StakingCredential]::Some{own_staking_credential}
          );

          open_treasury_txout: TxOutput =
            tx.outputs.find(
              (output: TxOutput) -> Bool {
                output.address == open_treasury_address
                  && output.value.to_map().length == 1
                  && output.value >= Value::lovelace(withdraw_amount)
              }
            );

          open_treasury_datum: OpenTreasuryDatum =
            open_treasury_txout.datum
              .switch {
                i: Inline => OpenTreasuryDatum::from_data(i.data),
                else => error("Invalid open treasury utxo: must inline datum")
              };

          own_staking_validator_hash: StakingValidatorHash =
            stakingCredentialToSVH(own_staking_credential);

          open_treasury_datum.governor_ada == withdraw_amount * pparams_datum.governor_share_ratio / MULTIPLIER
            && open_treasury_datum.tag.switch {
              tag: TagProtocolStakingRewards => tag.staking_validator == own_staking_validator_hash,
              else => false
            }
        },
        certifying: Certifying => {
          //TODO: optimize this
          pparams_datum: PParamsDatum =
            find_pparams_datum_from_outputs(
              tx.ref_inputs.map(
                (input: TxInput) -> TxOutput {input.output}
              ) + tx.outputs,
              PROTOCOL_NFT_MPH
            );

          is_authorized: Bool = is_tx_authorized_by(tx, pparams_datum.governor_address.credential);

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
