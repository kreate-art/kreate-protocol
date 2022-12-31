import { helios } from "../../program";

export type Params = {
  proofOfBackingMph: string;
  protocolNftMph: string;
};

export default function main({ proofOfBackingMph, protocolNftMph }: Params) {
  return helios`
    spending v__backing

    import { Redeemer } from v__backing__types
    import { Redeemer as PoBRedeemer } from proof_of_backing_types
    import { Datum as PParamsDatum } from v__protocol_params__types

    import { find_pparams_datum_from_inputs } from helpers

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const PROOF_OF_BACKING_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${proofOfBackingMph})

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      redeemer.switch {
        Unstake => {
          pob_script_purpose: ScriptPurpose =
            ScriptPurpose::new_minting(PROOF_OF_BACKING_MPH);

          pob_redeemer_data: Data = tx.redeemers.get(pob_script_purpose);

          PoBRedeemer::from_data(pob_redeemer_data).switch {
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
