import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  proofOfBackingMph: Hex;
  protocolNftMph: Hex;
};

export default function main({ proofOfBackingMph, protocolNftMph }: Params) {
  return helios`
    ${header("spending", "v__backing")}

    import { find_pparams_datum_from_inputs }
      from ${module("helpers")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import { Redeemer as PobRedeemer }
      from ${module("mp__proof_of_backing__types")}

    import { Redeemer }
      from ${module("v__backing__types")}

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const PROOF_OF_BACKING_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${proofOfBackingMph})

    func main(_, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      redeemer.switch {

        Unback => {
          pob_purpose: ScriptPurpose = ScriptPurpose::new_minting(PROOF_OF_BACKING_MPH);
          pob_redeemer: Data = tx.redeemers.get(pob_purpose);
          PobRedeemer::from_data(pob_redeemer).switch {
            Plant => true,
            else => false
          }
        },

        Migrate => {
          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);
          own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();
          migration_asset_class: AssetClass =
            pparams_datum
              .registry
              .backing_validator
              .migrations
              .get(own_validator_hash);
          tx.minted.get_safe(migration_asset_class) != 0
        }

      }
    }
  `;
}
