import { helios } from "../../program";

export function getSampleMigrateTokenPolicySource() {
  return helios("sample_migrate_token_policy", ["helpers"])`
    minting sample_migrate_token_policy

    import { is_tx_authorized_by } from helpers

    const SAMPLE_GOVERNOR_CREDENTIAL: Credential =
      Credential::new_pubkey(
        PubKeyHash::new(#eb91783097517294b44cecb55e83c4f3aae7cc27fd8f8553f146c6db)
      )

    func main(ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;

      is_tx_authorized_by(tx, SAMPLE_GOVERNOR_CREDENTIAL)
    }
  `;
}
