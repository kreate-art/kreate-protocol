import { Hex } from "@/types";

import { HeliosSource, helios } from "../../program";

export default function main(governorPkh: Hex): HeliosSource {
  return helios("mp__sample_migrate_token_policy", ["helpers"])`
    minting mp__sample_migrate_token_policy

    import { is_tx_authorized_by } from helpers

    const SAMPLE_GOVERNOR_CREDENTIAL: Credential =
      Credential::new_pubkey(
        PubKeyHash::new(#${governorPkh})
      )

    func main(ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      is_tx_authorized_by(tx, SAMPLE_GOVERNOR_CREDENTIAL)
    }
  `;
}
