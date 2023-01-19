import { OutRef } from "@/types";

import { helios, HeliosSource } from "../../program";

export type Params = {
  protocolSeed: OutRef;
};

export default function main({ protocolSeed }: Params): HeliosSource {
  return helios("nft__protocol", [
    "nft__protocol__types",
    "helpers",
    "constants",
  ])`
    minting nft__protocol

    import { Redeemer } from nft__protocol__types

    import { does_consume_input_with_output_id } from helpers

    import {
      PROTOCOL_PARAMS_NFT_TOKEN_NAME,
      PROTOCOL_PROPOSAL_NFT_TOKEN_NAME
    } from constants

    const seed_output_id: TxOutputId =
      TxOutputId::new(
        TxId::new(#${protocolSeed.txHash}),
        ${protocolSeed.outputIndex.toString()}
      )

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      redeemer.switch {
        Bootstrap => {
          assert (
            tx.minted.to_map().get(own_mph).all(
              (token_name: ByteArray, amount: Int) -> Bool {
                if (token_name == PROTOCOL_PARAMS_NFT_TOKEN_NAME) { amount == 1 }
                else if (token_name == PROTOCOL_PROPOSAL_NFT_TOKEN_NAME) { amount == 1 }
                else { false }
              }
            ),
            "Transaction must mint only two protocol params nft and protocol proposal nft"
          );

          does_consume_input_with_output_id(tx, seed_output_id)
        },
        else => false
      }
    }
  `;
}
