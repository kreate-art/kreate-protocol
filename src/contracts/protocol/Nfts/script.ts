import { helios, HeliosSource } from "../../program";

export function getProtocolNftPolicySource(
  seedTxId: string,
  seedTxIx: string
): HeliosSource {
  return helios`
    minting protocol_nft_policy

    import { Redeemer } from protocol_nft_types

    import { does_consume_input_with_output_id } from helpers

    import {
      PROTOCOL_PARAMS_NFT_TOKEN_NAME,
      PROTOCOL_PROPOSAL_NFT_TOKEN_NAME
    } from constants

    const seed_output_id: TxOutputId =
      TxOutputId::new(TxId::new(#${seedTxId}), ${seedTxIx})

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      own_mph: MintingPolicyHash = ctx.get_current_minting_policy_hash();

      redeemer.switch {
        Bootstrap => {
          protocol_params_nft: Value =
            Value::new(AssetClass::new(own_mph, PROTOCOL_PARAMS_NFT_TOKEN_NAME), 1);
          protocol_proposal_nft: Value =
            Value::new(AssetClass::new(own_mph, PROTOCOL_PROPOSAL_NFT_TOKEN_NAME), 1);

          assert (
            tx.minted == protocol_params_nft + protocol_proposal_nft,
            "Transaction must mint only two protocol params nft and protocol proposal nft"
          );

          does_consume_input_with_output_id(tx, seed_output_id)
        },
        else => false
      }
    }
  `;
}
