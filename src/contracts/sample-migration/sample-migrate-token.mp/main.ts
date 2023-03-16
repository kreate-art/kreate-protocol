import { Hex } from "@/types";

import { HeliosScript, helios, header, module } from "../../program";

export type Params = {
  governorPkh: Hex;
};

export default function main({ governorPkh }: Params): HeliosScript {
  return helios`
    ${header("minting", "mp__sample_migrate_token_policy")}

    import { is_tx_authorized_by }
      from ${module("helpers")}

    const SAMPLE_GOVERNOR_CREDENTIAL: Credential =
      Credential::new_pubkey(
        PubKeyHash::new(#${governorPkh})
      )

    func main(_, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      is_tx_authorized_by(tx, SAMPLE_GOVERNOR_CREDENTIAL)
    }
  `;
}
