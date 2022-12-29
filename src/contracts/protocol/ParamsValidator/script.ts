import { helios, HeliosSource } from "../../program";

export function getProtocolParamsValidatorSource(
  protocolNftMPH: string
): HeliosSource {
  return helios`
    spending protocol_params_validator

    import { Redeemer } from protocol_params_types
    import { Redeemer as ProposalRedeemer } from protocol_proposal_types

    import { find_tx_input_containing_exactly_one_token } from helpers

    import { PROTOCOL_PROPOSAL_NFT_TOKEN_NAME } from constants

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMPH})

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
