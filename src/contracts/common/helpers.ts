import { header, helios, module } from "../program";

export default helios`
  ${header("module", "helpers")}

  import { Datum as PParamsDatum }
    from ${module("v__protocol_params__types")}
  import {
    TokenPredicate,
    MintingPredicate,
    MintingRedeemer
  } from ${module("v__teiki_plant__types")}

  import {
    RATIO_MULTIPLIER,
    PROTOCOL_PARAMS_NFT_TOKEN_NAME
  } from ${module("constants")}

  func is_tx_authorized_by(tx: Tx, credential: Credential) -> Bool{
    credential.switch {
      pubkey:PubKey => {
        tx.is_signed_by(pubkey.hash)
      },
      else => {
        tx.inputs.any(
          (input: TxInput) -> Bool {
            input.output.address.credential == credential
          }
        )
      }
    }
  }

  func does_tx_pass_token_preciate_check(tx: Tx, predicate: TokenPredicate) -> Bool {
    mph: MintingPolicyHash = predicate.minting_policy_hash;

    predicate.token_names.switch {
      None => tx.inputs.any(
        (input: TxInput) -> Bool {
          input.output.value.contains_policy(mph)
        }
      ),
      else => {
        token_names: []ByteArray = predicate.token_names.unwrap();

        token_names.all(
          (token_name: ByteArray) -> Bool {
            tx.inputs.any(
              (input: TxInput) -> Bool {
                input.output.value.get_safe(AssetClass::new(mph, token_name)) > 0
              }
            )
          }
        )
      }
    }
  }

  func extract_constr_index(data: Data) -> Int {
    data.switch {
      (index: Int, dats: []Data) => {
        // Helios currently does not allow unused variables here,
        // hence we need to do this redundant check.
        if (dats.length >= 0) { index }
        else { error("Invalid Constr") }
      },
      else => error("Must be a Constr value")
    }
  }


  func does_tx_pass_minting_preciate_check(tx: Tx, predicate: MintingPredicate) -> Bool {
    mph: MintingPolicyHash = predicate.minting_policy_hash;
    minting_redeemer_data: Data =
      tx.redeemers.get(ScriptPurpose::new_minting(mph));

    predicate.redeemer.switch {
      Any => true,
      constr_in: ConstrIn => {
        minting_constr: Int = extract_constr_index(minting_redeemer_data);

        constr_in.constrs.any(
          (constr: Int) -> { constr == minting_constr }
        )
      },
      constr_not_in: ConstrNotIn => {
        minting_constr: Int = extract_constr_index(minting_redeemer_data);

        constr_not_in.constrs.all(
          (constr: Int) -> { constr != minting_constr }
        )
      }
    }
  }

  func find_tx_input_with_value(inputs: []TxInput, value: Value) -> TxInput {
    inputs.find(
      (input: TxInput) -> Bool { input.output.value.contains(value) }
    )
  }

  func find_tx_output_with_value(outputs: []TxOutput, value: Value) -> TxOutput {
    outputs.find(
      (output: TxOutput) -> Bool { output.value.contains(value) }
    )
  }

  func get_pparams_datum(txout: TxOutput) -> PParamsDatum {
    txout.datum.switch {
      i: Inline => PParamsDatum::from_data(i.data),
      else => error("Invalid protocol params UTxO: missing inline datum")
    }
  }

  func get_protocol_params_nft(mph: MintingPolicyHash) -> Value {
    protocol_params_nft_asset_class: AssetClass =
      AssetClass::new(mph, PROTOCOL_PARAMS_NFT_TOKEN_NAME);

    Value::new(protocol_params_nft_asset_class, 1)
  }

  func find_pparams_datum_from_inputs (
    inputs: []TxInput,
    protocol_nft_mph: MintingPolicyHash
  ) -> PParamsDatum {
    protocol_params_nft: Value = get_protocol_params_nft(protocol_nft_mph);

    pparams_txinput: TxInput = find_tx_input_with_value(inputs, protocol_params_nft);

    get_pparams_datum(pparams_txinput.output)
  }

  // TODO: functions like this should be optimized
  func find_pparams_datum_from_outputs (
    outputs: []TxOutput,
    protocol_nft_mph: MintingPolicyHash
  ) -> PParamsDatum {
    protocol_params_nft: Value = get_protocol_params_nft(protocol_nft_mph);

    pparams_txout: TxOutput = find_tx_output_with_value(outputs, protocol_params_nft);

    get_pparams_datum(pparams_txout)
  }

  func does_consume_input_with_output_id(tx: Tx, seed_output_id: TxOutputId) -> Bool {
    tx.inputs.any(
      (input: TxInput) -> Bool {
        input.output_id == seed_output_id
      }
    )
  }

  func stakingCredentialToSVH(staking_credential: StakingCredential) -> StakingValidatorHash {
    staking_credential.switch{
      h: Hash => h.hash.switch{
        v: Validator => v.hash,
        else => error("not StakingValidatorHash")},
      else => error("not StakingHash")
    }
  }

  func scriptHashToStakingCredential(script_hash: ScriptHash) -> StakingCredential {
    StakingCredential::new_hash(
      StakingHash::new_validator(
        StakingValidatorHash::from_script_hash(script_hash)
      )
    )
  }

  func min(a: Int, b: Int) -> Int {
    if (a < b) {
      a
    } else {
      b
    }
  }

  func max(a: Int, b: Int) -> Int {
    if (a > b) {
      a
    } else {
      b
    }
  }
`;
