import { helios, HeliosSource } from "../../program";

export function getProtocolScriptSource(protocolNftMPH: string): HeliosSource {
  return helios`
    spending protocol_script

    import { Datum as PParamsDatum } from protocol_params_types

    import {
      find_pparams_datum_from_inputs,
      is_tx_authorized_by
    } from helpers

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMPH})

    func main(ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      is_tx_authorized_by(tx, pparams_datum.governor_address.credential)
    }
  `;
}
