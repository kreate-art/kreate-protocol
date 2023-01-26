import {
  Address,
  AssetClass,
  Duration,
  PaymentCredential,
  ScriptHash,
  Time,
  TxOutputId,
  ValidatorHash,
} from "../helios";
import { Enum, Int, List, Map, Option, Static, Struct, Void } from "../uplc";

// ==================== V | Protocol Params ====================

export const MigratableScript = Struct({
  latest: ValidatorHash,
  migrations: Map(ValidatorHash, AssetClass),
});
export type MigratableScript = Static<typeof MigratableScript>;

export const Registry = Struct({
  protocolStakingValidator: ScriptHash,
  projectValidator: MigratableScript,
  projectDetailValidator: MigratableScript,
  projectScriptValidator: MigratableScript,
  backingValidator: MigratableScript,
  dedicatedTreasuryValidator: MigratableScript,
  sharedTreasuryValidator: MigratableScript,
  openTreasuryValidator: MigratableScript,
});
export type Registry = Static<typeof Registry>;

export const ProtocolParamsDatum = Struct({
  registry: Registry,
  governorAddress: Address,
  governorShareRatio: Int,
  protocolFundsShareRatio: Int,
  discountCentPrice: Int,
  projectMilestones: List(Int),
  teikiCoefficient: Int,
  projectTeikiBurnRate: Int,
  epochLength: Duration,
  projectPledge: Int,
  stakingManager: PaymentCredential,
  projectCreationFee: Int,
  projectSponsorshipFee: Int,
  projectSponsorshipDuration: Duration,
  projectInformationUpdateFee: Int,
  projectCommunityUpdateFee: Int,
  minTreasuryPerMilestoneEvent: Int,
  stakeKeyDeposit: Int,
  proposalWaitingPeriod: Duration,
  projectDelistWaitingPeriod: Duration,
});
export type ProtocolParamsDatum = Static<typeof ProtocolParamsDatum>;
export type ProtocolNonScriptParams = Omit<
  ProtocolParamsDatum,
  "registry" | "governorAddress" | "stakingManager"
>;

// TODO: Remove this after the migration on testnet is over
const { stakingManager: _, ...legacyProtocolParamsProperties } =
  ProtocolParamsDatum.properties;
export const LegacyProtocolParamsDatum = Struct(legacyProtocolParamsProperties);
export type LegacyProtocolParamsDatum = Static<
  typeof LegacyProtocolParamsDatum
>;
export function isLegacyProtocolParams(
  datum: ProtocolParamsDatum | LegacyProtocolParamsDatum
): datum is LegacyProtocolParamsDatum {
  return !("stakingManager" in datum);
}

export const ProtocolParamsRedeemer = Enum("case", {
  ApplyProposal: Void,
});
export type ProtocolParamsRedeemer = Static<typeof ProtocolParamsRedeemer>;

// ==================== V | Protocol Proposal ====================

export const ProtocolProposal = Struct({
  inEffectAt: Time,
  base: TxOutputId,
  params: ProtocolParamsDatum,
});
export type ProtocolProposal = Static<typeof ProtocolProposal>;

export const ProtocolProposalDatum = Struct({
  proposal: Option(ProtocolProposal),
});
export type ProtocolProposalDatum = Static<typeof ProtocolProposalDatum>;

export const ProtocolProposalRedeemer = Enum("case", {
  Propose: Void,
  Apply: Void,
  Cancel: Void,
});
export type ProtocolProposalRedeemer = Static<typeof ProtocolProposalRedeemer>;

// ==================== NFT | Protocol ====================

export const ProtocolNftMintingRedeemer = Enum("case", {
  Bootstrap: Void,
});
export type ProtocolNftMintingRedeemer = Static<
  typeof ProtocolNftMintingRedeemer
>;
