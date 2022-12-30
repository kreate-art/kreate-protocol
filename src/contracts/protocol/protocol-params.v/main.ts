import { helios, HeliosSource } from "../../program";

export default function main(protocolNftMph: string): HeliosSource {
  return helios`
    spending v__protocol_params

    import { Redeemer } from v__protocol_params__types
    import { Redeemer as ProposalRedeemer } from v__protocol_proposal__types

    import { find_tx_input_containing_exactly_one_token } from helpers

    import { PROTOCOL_PROPOSAL_NFT_TOKEN_NAME } from constants

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const PROTOCOL_PROPOSAL_NFT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROTOCOL_NFT_MPH, PROTOCOL_PROPOSAL_NFT_TOKEN_NAME)

    // check if utxo containing proposal nft is consumed with Redeemer::Apply
    // another way is that find the input contaims nft then check the redeemer
    func does_apply_proposal_utxo_correctly(tx: Tx) -> Bool {
      proposal_txinput: TxInput =
        find_tx_input_containing_exactly_one_token(
          tx.inputs,
          PROTOCOL_PROPOSAL_NFT_ASSET_CLASS
        );

      proposal_script_purpose: ScriptPurpose =
        ScriptPurpose::new_spending(proposal_txinput.output_id);

      proposal_redeemer_data: Data = tx.redeemers.get(proposal_script_purpose);

      ProposalRedeemer::from_data(proposal_redeemer_data).switch{
        Apply => true,
        else => false
      }
    }

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool{
      tx: Tx = ctx.tx;

      redeemer.switch {
        ApplyProposal => does_apply_proposal_utxo_correctly(tx),
        else => false
      }
    }
  `;
}
