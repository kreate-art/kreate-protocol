import { OutRef } from "@/types";

import { HeliosScript, helios, module, header } from "../../program";

export type Params = {
  teikiPlantSeed: OutRef;
};

export default function main({ teikiPlantSeed }: Params): HeliosScript {
  return helios`
    ${header("minting", "nft__teiki_plant")}

    import { TEIKI_PLANT_NFT_TOKEN_NAME }
      from ${module("constants")}

    import { Redeemer }
      from ${module("nft__teiki_plant__types")}

    const SEED_OUTPUT_ID: TxOutputId =
      TxOutputId::new(
        TxId::new(#${teikiPlantSeed.txHash}),
        ${teikiPlantSeed.outputIndex}
      )

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      redeemer.switch {

        Bootstrap => {
          tx.inputs.any((input: TxInput) -> { input.output_id == SEED_OUTPUT_ID })
           && tx.minted.get_policy(own_mph) == Map[ByteArray]Int {TEIKI_PLANT_NFT_TOKEN_NAME: 1}
        }

      }
    }
  `;
}
