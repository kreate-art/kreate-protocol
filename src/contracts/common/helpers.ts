import { header, helios, module } from "../program";

export default helios`
  ${header("module", "helpers")}

  import {
    RATIO_MULTIPLIER,
    PROTOCOL_PARAMS_NFT_TOKEN_NAME
  } from ${module("constants")}

  import { Datum as PParamsDatum }
    from ${module("v__protocol_params__types")}

  import {
    TokenPredicate,
    MintingPredicate,
    MintingRedeemer
  } from ${module("v__teiki_plant__types")}

  func is_tx_authorized_by(tx: Tx, credential: Credential) -> Bool{
    credential.switch {
      pubKey: PubKey => {
        tx.is_signed_by(pubKey.hash)
      },
      else => {
        tx.inputs.any(
          (input: TxInput) -> {
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
        (input: TxInput) -> {
          input.output.value.contains_policy(mph)
        }
      ),
      else => {
        token_names: []ByteArray = predicate.token_names.unwrap();

        token_names.all(
          (token_name: ByteArray) -> {
            tx.inputs.any(
              (input: TxInput) -> {
                input.output.value.get_safe(AssetClass::new(mph, token_name)) > 0
              }
            )
          }
        )
      }
    }
  }

  func does_tx_pass_minting_preciate_check(tx: Tx, predicate: MintingPredicate) -> Bool {
    mph: MintingPolicyHash = predicate.minting_policy_hash;
    minting_redeemer_data: Data =
      tx.redeemers.get(ScriptPurpose::new_minting(mph));

    predicate.redeemer.switch {
      Any => true,
      constr_in: ConstrIn => {
        minting_constr_tag: Int = minting_redeemer_data.tag;
        constr_in.constrs.any(
          (constr: Int) -> { constr == minting_constr_tag }
        )
      },
      constr_not_in: ConstrNotIn => {
        minting_constr_tag: Int = minting_redeemer_data.tag;
        constr_not_in.constrs.all(
          (constr: Int) -> { constr != minting_constr_tag }
        )
      }
    }
  }

  func parse_pparams_datum(txout: TxOutput) -> PParamsDatum {
    txout.datum.switch {
      i: Inline => PParamsDatum::from_data(i.data),
      else => error("Invalid protocol params UTxO: missing inline datum")
    }
  }

  func find_tx_input_with_auth_token(inputs: []TxInput, auth_token: AssetClass) -> TxInput {
    inputs.find((input: TxInput) -> { input.output.value.get_safe(auth_token) == 1 })
  }

  func find_tx_output_with_auth_token(outputs: []TxOutput, auth_token: AssetClass) -> TxOutput {
    outputs.find((output: TxOutput) -> { output.value.get_safe(auth_token) == 1 })
  }

  // TODO: Please don't do this
  func get_protocol_params_nft(mph: MintingPolicyHash) -> AssetClass {
    AssetClass::new(mph, PROTOCOL_PARAMS_NFT_TOKEN_NAME)
  }

  // TODO: PROTOCOL_NFT_MPH should be a global param
  func find_pparams_datum_from_inputs(
    inputs: []TxInput,
    protocol_nft_mph: MintingPolicyHash
  ) -> PParamsDatum {
    protocol_params_nft: AssetClass = get_protocol_params_nft(protocol_nft_mph);
    pparams_txinput: TxInput = find_tx_input_with_auth_token(inputs, protocol_params_nft);
    parse_pparams_datum(pparams_txinput.output)
  }

  // TODO: PROTOCOL_NFT_MPH should be a global param
  func find_pparams_datum_from_outputs(
    outputs: []TxOutput,
    protocol_nft_mph: MintingPolicyHash
  ) -> PParamsDatum {
    protocol_params_nft: AssetClass = get_protocol_params_nft(protocol_nft_mph);
    pparams_txout: TxOutput = find_tx_output_with_auth_token(outputs, protocol_params_nft);
    parse_pparams_datum(pparams_txout)
  }

  func staking_credential_to_validator_hash(staking_credential: StakingCredential) -> StakingValidatorHash {
    staking_credential.switch {
      h: Hash => h.hash.switch {
        v: Validator => v.hash,
        else => error("not StakingValidatorHash")},
      else => error("not StakingHash")
    }
  }

  func script_hash_to_staking_credential(script_hash: ScriptHash) -> StakingCredential {
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
