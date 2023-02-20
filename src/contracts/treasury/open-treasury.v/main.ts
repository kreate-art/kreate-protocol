import { Hex } from "@/types";

import { header, helios, module } from "../../program";

export type Params = {
  protocolNftMph: Hex;
};

export default function main({ protocolNftMph }: Params) {
  return helios`
    ${header("spending", "v__open_treasury")}

    import {
      RATIO_MULTIPLIER,
      TREASURY_MIN_WITHDRAWAL_ADA,
      TREASURY_WITHDRAWAL_DISCOUNT_RATIO
    } from ${module("constants")}

    import {
      find_pparams_datum_from_inputs,
      min, max,
      is_tx_authorized_by,
      script_hash_to_staking_credential
    } from ${module("helpers")}

    import { UserTag, TreasuryTag }
      from ${module("common__types")}

    import { Datum as PParamsDatum }
      from ${module("v__protocol_params__types")}

    import { Datum, Redeemer }
      from ${module("v__open_treasury__types")}

    const PROTOCOL_NFT_MPH: MintingPolicyHash =
      MintingPolicyHash::new(#${protocolNftMph})

    func main(datum: Datum, redeemer: Redeemer, ctx: ScriptContext) -> Bool {
      tx: Tx = ctx.tx;
      redeemer.switch {

        collect: CollectDelayedStakingRewards => {
          own_spending_output: TxOutput = ctx.get_current_input().output;

          own_credential: Credential = own_spending_output.address.credential;

          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

          own_credential.switch {
            PubKey => error("unreachable"),
            v: Validator =>
              assert(
                v.hash == pparams_datum.registry.open_treasury_validator.latest,
                "Wrong script version"
              )
          };

          assert(
            tx.inputs.fold(
              (acc: Int, input: TxInput) -> {
                if (input.output.address.credential == own_credential) { acc + 1 }
                else { acc }
              },
              0
            ) == 1,
            "Must consume only one open treasury"
          );

          total_withdrawal: Int =
            collect.staking_withdrawals.fold(
              (acc: Int, _, withdrawal: Int) -> { acc + withdrawal }, 0
            );

          producing_address: Address =
            Address::new(
              own_credential,
              Option[StakingCredential]::Some{
                script_hash_to_staking_credential(
                  pparams_datum.registry.protocol_staking_validator
                )
              }
            );

          producing_value: Value =
            Value::lovelace(
              own_spending_output.value.get(AssetClass::ADA) + total_withdrawal
            );

          producing_datum: Datum =
            Datum {
              governor_ada:
                datum.governor_ada
                  + total_withdrawal * pparams_datum.governor_share_ratio / RATIO_MULTIPLIER,
              tag: TreasuryTag::TagProjectDelayedStakingRewards {
                staking_validator: Option[StakingValidatorHash]::None
              }
            };

          tx.outputs.any(
            (output: TxOutput) -> {
              output.address == producing_address
                && output.value == producing_value
                && output.datum.switch {
                    i: Inline => Datum::from_data(i.data) == producing_datum,
                    else => error("Invalid open treasury UTxO: missing inline datum")
                  }
            }
          )
        },

        WithdrawAda => {
          own_spending_input: TxInput = ctx.get_current_input();

          own_spending_output_id: TxOutputId = own_spending_input.output_id;
          own_spending_output: TxOutput = own_spending_input.output;

          own_address: Address = own_spending_output.address;
          own_credential: Credential = own_address.credential;

          empty: []TxOutput = []TxOutput {};

          treasury_outputs: []TxOutput =
            tx.inputs
              .fold_lazy(
                (input: TxInput, next: () -> []TxOutput) -> {
                  output: TxOutput = input.output;
                  if (output.address.credential == own_credential) {
                    if (input.output_id < own_spending_output_id) { empty }
                    else { next().prepend(output) }
                  } else { next() }
                },
                empty
              );

          if (!treasury_outputs.is_empty()) {
            pparams_datum: PParamsDatum =
              find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);

            own_credential.switch {
              PubKey => error("unreachable"),
              v: Validator =>
                assert(
                  v.hash == pparams_datum.registry.open_treasury_validator.latest,
                  "Wrong script version"
                )
            };

            producing_datum: Datum =
              Datum {
                governor_ada: 0,
                tag: TreasuryTag::TagContinuation {former: own_spending_output_id}
              };

            producing_output: TxOutput =
              tx.outputs.find(
                (output: TxOutput) -> {
                  output.address == own_address
                    && output.datum.switch {
                        i: Inline => Datum::from_data(i.data) == producing_datum,
                        else => error("Invalid open treasury UTxO: Missing inline datum")
                      }
                }
              );

            (in_w: Int, in_g: Int) =
              treasury_outputs.fold(
                (acc: () -> (Int, Int), output: TxOutput) -> {
                  (aw: Int, ag: Int) = acc();
                  governor_ada: Int = output.datum.switch {
                    i: Inline => Datum::from_data(i.data).governor_ada,
                    else => error("Invalid treasury UTxO: missing inline datum")
                  };
                  w: Int = output.value.get(AssetClass::ADA);
                  g: Int = min(max(0, governor_ada), w);
                  () -> {(aw + w, ag + g)}
                },
                () -> {(0, 0)}
              )();

            out_w: Int = producing_output.value.get(AssetClass::ADA);

            delta: Int = in_w - out_w;

            assert(delta == in_g, "Governor ada must be balanced");

            governor_address: Address = pparams_datum.governor_address;
            if (is_tx_authorized_by(tx, governor_address.credential)) {
              assert(delta > 0, "Governor withdrawal must be positive")
            } else {
              assert(
                delta >= TREASURY_MIN_WITHDRAWAL_ADA,
                "Withdrawal must exceed minimum amount"
              );
              governor_value: Value =
                Value::lovelace(
                  delta * (RATIO_MULTIPLIER - TREASURY_WITHDRAWAL_DISCOUNT_RATIO) / RATIO_MULTIPLIER
                );
              governor_tag: UserTag =
                UserTag::TagTreasuryWithdrawal {treasury_output_id: own_spending_output_id};
              assert(
                tx.outputs.any(
                  (output: TxOutput) -> {
                    output.address == governor_address
                      && output.value == governor_value
                      && output.datum.switch {
                        i: Inline => UserTag::from_data(i.data) == governor_tag,
                        else => false
                      }
                  }
                ),
                "Must pay to governor"
              )
            }
          };

          true
        },

        Migrate => {
          own_validator_hash: ValidatorHash = ctx.get_current_validator_hash();
          pparams_datum: PParamsDatum =
            find_pparams_datum_from_inputs(tx.ref_inputs, PROTOCOL_NFT_MPH);
          migration_asset_class: AssetClass =
            pparams_datum
              .registry
              .open_treasury_validator
              .migrations
              .get(own_validator_hash);
          tx.minted.get_safe(migration_asset_class) != 0
        }

      }
    }
  `;
}
