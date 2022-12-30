import { helios, HeliosSource } from "../../program";

export default function main(protocolNftMph: string): HeliosSource {
  return helios`
    spending v__protocol_script

    import { Datum as PParamsDatum } from v__protocol_params__types

    import {
      find_pparams_datum_from_inputs,
      is_tx_authorized_by
    } from helpers

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      pparams_datum: PParamsDatum =
        find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

      is_tx_authorized_by(tx, pparams_datum.governor_address.credential)
    }
  `;
}
