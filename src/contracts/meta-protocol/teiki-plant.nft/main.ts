import { OutRef } from "@/types";

import { HeliosSource, helios } from "../../program";

export type Params = {
  teikiPlantSeed: OutRef;
};

export default function main({ teikiPlantSeed }: Params): HeliosSource {
  return helios("nft__teiki_plant", [
    "constants",
    "helpers",
    "nft__teiki_plant__types",
  ])`
    minting nft__teiki_plant

    import { TEIKI_PLANT_NFT_TOKEN_NAME } from constants

    import { does_consume_input_with_output_id } from helpers

    import { Redeemer } from nft__teiki_plant__types

    const seed_output_id: TxOutputId =
      TxOutputId::new(
        TxId::new(#${teikiPlantSeed.txHash}),
        ${teikiPlantSeed.outputIndex.toString()}
      )

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      redeemer.switch {
        Bootstrap => {
          does_consume_input_with_output_id(tx, seed_output_id)
           && tx.minted.get_policy(own_mph) == Map[ByteArray]Int {TEIKI_PLANT_NFT_TOKEN_NAME: 1}
        }
      }
    }
  `;
}
