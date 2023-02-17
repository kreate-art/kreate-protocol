import { OutRef } from "@/types";

import { header, helios, HeliosScript, module } from "../../program";

export type Params = {
  protocolSeed: OutRef;
};

export default function main({ protocolSeed }: Params): HeliosScript {
  return helios`
    ${header("minting", "nft__protocol")}

    import {
      PROTOCOL_PARAMS_NFT_TOKEN_NAME,
      PROTOCOL_PROPOSAL_NFT_TOKEN_NAME
    } from ${module("constants")}

    import { Redeemer }
      from ${module("nft__protocol__types")}

    const SEED_OUTPUT_ID: TxOutputId =
      TxOutputId::new(
        TxId::new(#${protocolSeed.txHash}),
        ${protocolSeed.outputIndex}
      )

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      redeemer.switch {

        Bootstrap => {
          assert(
            tx.minted.to_map().get(own_mph).all(
              (token_name: ByteArray, amount: Int) -> {
                if (token_name == PROTOCOL_PARAMS_NFT_TOKEN_NAME) { amount == 1 }
                else if (token_name == PROTOCOL_PROPOSAL_NFT_TOKEN_NAME) { amount == 1 }
                else { false }
              }
            ),
            "Transaction must mint only two protocol params nft and protocol proposal nft"
          );

          tx.inputs.any((input: TxInput) -> { input.output_id == SEED_OUTPUT_ID })
        }

      }
    }
  `;
}
