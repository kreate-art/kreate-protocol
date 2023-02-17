import { Hex } from "@/types";

import { header, helios, HeliosScript, module } from "../../program";

export type Params = {
  protocolNftMph: Hex;
};

export default function main({ protocolNftMph }: Params): HeliosScript {
  return helios`
    ${header("spending", "v__protocol_script")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import {
      find_pparams_datum_from_inputs,
      is_tx_authorized_by
    } from ${module("helpers")}

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
