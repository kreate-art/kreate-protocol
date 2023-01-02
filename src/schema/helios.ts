import {
  ByteArray,
  ConStruct,
  Enum,
  Inline,
  Int,
  Map,
  Option,
  Struct,
  Id,
  type Static,
} from "./uplc";

// Helios builtins
export const Hash = Id("Hash")(Struct({ hash: ByteArray }));

const IScriptHash = Struct({ script: Hash });
export const ScriptHash = Id("ScriptHash")(IScriptHash);
export const ValidatorHash = Id("ValidatorHash")(IScriptHash);
export const MintingPolicyHash = Id("MintingPolicyHash")(IScriptHash);
export const StakingValidatorHash = Id("StakingValidatorHash")(IScriptHash);

const IKeyHash = Struct({ key: Hash });
export const PubKeyHash = Id("PubKeyHash")(IKeyHash);
export const StakeKeyHash = Id("StakeKeyHash")(IKeyHash);

export const PaymentCredential = Id("PaymentCredential")(
  Enum("type", {
    PubKey: Inline(PubKeyHash, "hash"),
    Validator: Inline(ValidatorHash, "hash"),
  })
);
export const StakingCredential = Id("StakingCredential")(
  Enum("kind", {
    Hash: Inline(
      Enum("type", {
        StakeKey: Inline(StakeKeyHash, "hash"),
        Validator: Inline(ValidatorHash, "hash"),
      })
    ),
    Ptr: { slotNo: Int, txIndex: Int, certIndex: Int },
  })
);
export const Address = Id("Address")(
  ConStruct({
    paymentCredential: PaymentCredential,
    stakingCredential: Option(StakingCredential),
  })
);

export const TxId = Id("TxId")(ConStruct(Inline(ByteArray)));
export const TxOutputId = Id("TxOutputId")(
  ConStruct({ txId: TxId, index: Int })
);

export const AssetClass = Id("AssetClass")(
  ConStruct({
    mintingPolicyHash: MintingPolicyHash,
    tokenName: ByteArray,
  })
);
export const Value = Id("Value")(
  Struct(Inline(Map(MintingPolicyHash, Map(ByteArray, Int))))
);

export const Time = Id("Time")(Struct({ timestamp: Int }));
export const Duration = Id("Duration")(Struct({ milliseconds: Int }));

export type Hash = Static<typeof Hash>;
export type ScriptHash = Static<typeof ScriptHash>;
export type ValidatorHash = Static<typeof ValidatorHash>;
export type MintingPolicyHash = Static<typeof MintingPolicyHash>;
export type StakingValidatorHash = Static<typeof StakingValidatorHash>;
export type PubKeyHash = Static<typeof PubKeyHash>;
export type StakeKeyHash = Static<typeof StakeKeyHash>;
export type PaymentCredential = Static<typeof PaymentCredential>;
export type StakingCredential = Static<typeof StakingCredential>;
export type Address = Static<typeof Address>;
export type TxId = Static<typeof TxId>;
export type TxOutputId = Static<typeof TxOutputId>;
export type AssetClass = Static<typeof AssetClass>;
export type Value = Static<typeof Value>;
export type Time = Static<typeof Time>;
export type Duration = Static<typeof Duration>;

// Missing types
// - DCert
// - DatumHash
// - OutputDatum
// - PubKey
// - ScriptContext
// - ScriptPurpose
// - StakingPurpose
// - TimeRange
// - Tx
// - TxInput
// - TxOutput
