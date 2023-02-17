import { Hex } from "@/types";

import { header, helios, HeliosScript, module } from "../../program";

export type Params = {
  protocolNftMph: Hex;
};

export default function main({ protocolNftMph }: Params): HeliosScript {
  return helios`
    ${header("spending", "v__protocol_params")}


    import { PROTOCOL_PROPOSAL_NFT_TOKEN_NAME }
      from ${module("constants")}

    import { Redeemer as ProposalRedeemer }
      from ${module("v__protocol_proposal__types")}

    import { Redeemer }
      from ${module("v__protocol_params__types")}

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    const PROTOCOL_PROPOSAL_NFT_ASSET_CLASS: AssetClass =
      AssetClass::new(PROTOCOL_NFT_MPH, PROTOCOL_PROPOSAL_NFT_TOKEN_NAME)

    func main(redeemer: Redeemer, ctx: ScriptContext) -> Bool{
      tx: Tx = ctx.tx;

      redeemer.switch {

        ApplyProposal => {
          proposal_txinput: TxInput =
            tx.inputs.find(
              (input: TxInput) -> {
                input.output.value.get_safe(PROTOCOL_PROPOSAL_NFT_ASSET_CLASS) == 1
              }
            );

          proposal_purpose: ScriptPurpose =
            ScriptPurpose::new_spending(proposal_txinput.output_id);

          proposal_redeemer: Data = tx.redeemers.get(proposal_purpose);

          ProposalRedeemer::from_data(proposal_redeemer).switch {
            Apply => true,
            else => false
          }
        }

      }
    }
  `;
}
