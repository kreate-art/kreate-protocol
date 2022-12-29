import {
  Duration,
  MintingPolicyHash,
  PaymentCredential,
  Time,
} from "../helios";
import {
  ByteArray,
  Enum,
  Int,
  List,
  Map,
  Option,
  Static,
  Struct,
} from "../uplc";

// ==================== Predicates ====================

export const MintingRedeemer = Enum("redeemer", {
  Any: {},
  ConstrIn: { constrs: List(Int) },
  ConstrNotIn: { constrs: List(Int) },
});
export type MintingRedeemer = Static<typeof MintingRedeemer>;

export const MintingAmount = Enum("amount", {
  Zero: {},
  NonZero: {},
  Positive: {},
  Negative: {},
});
export type MintingAmount = Static<typeof MintingAmount>;

export const MintingPredicate = Struct({
  mintingPolicyHash: MintingPolicyHash,
  redeemer: MintingRedeemer,
  amounts: Option(Map(ByteArray, MintingAmount)),
});
export type MintingPredicate = Static<typeof MintingPredicate>;

export const TokenPredicate = Struct({
  mintingPolicyHash: MintingPolicyHash,
  tokenNames: Option(List(ByteArray)),
});
export type TokenPredicate = Static<typeof TokenPredicate>;

// ==================== V | Teiki Plant ====================

export const Authorization = Enum("authorization", {
  MustBe: { credential: PaymentCredential },
  MustHave: { predicate: TokenPredicate },
  MustMint: { predicate: MintingPredicate },
});
export type Authorization = Static<typeof Authorization>;

export const Rules = Struct({
  teikiMintingRules: List(MintingPredicate),
  proposalAuthorizations: List(Authorization),
  proposalWaitingPeriod: Duration,
});
export type Rules = Static<typeof Rules>;

export const RulesProposal = Struct({
  inEffectAt: Time,
  rules: Rules,
});
export type RulesProposal = Static<typeof RulesProposal>;

export const TeikiPlantDatum = Struct({
  rules: Rules,
  proposal: Option(RulesProposal),
});
export type TeikiPlantDatum = Static<typeof TeikiPlantDatum>;

export const TeikiPlantRedeemer = Enum("case", {
  Propose: {},
  Apply: {},
  Cancel: {},
});
export type TeikiPlantRedeemer = Static<typeof TeikiPlantRedeemer>;

// ==================== NFT | Teiki Plant ====================

export const TeikiPlantNftMintingRedeemer = Enum("case", { Bootstrap: {} });
export type TeikiPlantNftMintingRedeemer = Static<
  typeof TeikiPlantNftMintingRedeemer
>;

// ==================== MP | Teiki ====================

export const TeikiMintingRedeemer = Enum("case", {
  Mint: {},
  Burn: {},
  Evolve: {},
});
export type TeikiMintingRedeemer = Static<typeof TeikiMintingRedeemer>;
