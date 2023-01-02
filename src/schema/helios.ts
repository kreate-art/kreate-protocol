import {
  ByteArray,
  ConStruct,
  Enum,
  Inline,
  Int,
  Map,
  Option,
  Struct,
  type Static,
} from "./uplc";

// Helios builtins
export const Hash = Struct({ hash: ByteArray });

export const ScriptHash = Struct({ script: Hash });
export const ValidatorHash = ScriptHash;
export const MintingPolicyHash = ScriptHash;
export const StakingValidatorHash = ScriptHash;

export const PubKeyHash = Struct({ key: Hash });
export const StakeKeyHash = Struct({ key: Hash });
export const PaymentCredential = Enum("type", {
  PubKey: Inline(PubKeyHash, "hash"),
  Validator: Inline(ValidatorHash, "hash"),
});

export const StakingCredential = Enum("kind", {
  Hash: Inline(
    Enum("type", {
      StakeKey: Inline(StakeKeyHash, "hash"),
      Validator: Inline(ValidatorHash, "hash"),
    })
  ),
  Ptr: { slotNo: Int, txIndex: Int, certIndex: Int },
});
export const Address = ConStruct({
  paymentCredential: PaymentCredential,
  stakingCredential: Option(StakingCredential),
});

export const TxId = ConStruct(Inline(ByteArray));
export const TxOutputId = ConStruct({ txId: TxId, index: Int });

export const AssetClass = ConStruct({
  mintingPolicyHash: MintingPolicyHash,
  tokenName: ByteArray,
});
export const Value = Struct(
  Inline(Map(MintingPolicyHash, Map(ByteArray, Int)))
);

export const Time = Struct({ timestamp: Int });
export const Duration = Struct({ milliseconds: Int });

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
