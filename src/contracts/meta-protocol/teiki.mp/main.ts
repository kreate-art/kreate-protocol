import { Hex } from "@/types";

import { HeliosScript, helios, header, module } from "../../program";

export type Params = {
  teikiPlantNftMph: Hex;
};

export default function main({ teikiPlantNftMph }: Params): HeliosScript {
  return helios`
    ${header("minting", "mp__teiki")}

    import {
      TEIKI_TOKEN_NAME,
      TEIKI_PLANT_NFT_TOKEN_NAME
    } from ${module("constants")}

    import {
      does_tx_pass_minting_preciate_check
    } from ${module("helpers")}

    import {
      Datum as TeikiPlantDatum,
      MintingPredicate
    } from ${module("v__teiki_plant__types")}

    import { Redeemer }
      from ${module("mp__teiki__types")}

    const TEIKI_PLANT_NFT_ASSET_CLASS: AssetClass =
      AssetClass::new(
        MintingPolicyHash::new(#${teikiPlantNftMph}),
        TEIKI_PLANT_NFT_TOKEN_NAME
      )

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      redeemer.switch {
        Mint => {
          own_minted: Map[ByteArray]Int = tx.minted.get_policy(own_mph);

          teiki_plant_txout: TxOutput =
            tx.ref_inputs
              .find(
                (input: TxInput) -> Bool {
                  input.output.value.get_safe(TEIKI_PLANT_NFT_ASSET_CLASS) == 1
                }
              )
              .output;

          teiki_plant_datum: TeikiPlantDatum =
            teiki_plant_txout.datum.switch {
              i: Inline => TeikiPlantDatum::from_data(i.data),
              else => error("Invalid teiki-plant UTxO: missing inline datum")
            };

          own_minted.all(
            (token_name: ByteArray, _) -> Bool {
              token_name == TEIKI_TOKEN_NAME
            }
          )
           && teiki_plant_datum.rules.teiki_minting_rules.all(
                (teiki_minting_predicate: MintingPredicate) -> Bool {
                  does_tx_pass_minting_preciate_check(tx, teiki_minting_predicate)
                }
              )
        },

        Burn => {
          own_minted: Map[ByteArray]Int = tx.minted.get_policy(own_mph);

          own_minted.all(
            (token_name: ByteArray, amount: Int) -> Bool {
              if (token_name == TEIKI_TOKEN_NAME) { amount < 0 }
              else { false }
            }
          )
        },

        Evolve => {
          !tx.outputs.any(
            (output: TxOutput) -> Bool {
              output.value.contains_policy(own_mph)
            }
          )
        }

      }
    }
  `;
}
