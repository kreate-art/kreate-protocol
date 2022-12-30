import {
  Address,
  AssetClass,
  Duration,
  ScriptHash,
  Time,
  TxOutputId,
  ValidatorHash,
} from "../helios";
import { Enum, Int, List, Map, Option, Static, Struct } from "../uplc";

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

export const ProtocolParamsRedeemer = Enum("case", {
  ApplyProposal: {},
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
  Propose: {},
  Apply: {},
  Cancel: {},
});
export type ProtocolProposalRedeemer = Static<typeof ProtocolProposalRedeemer>;

// ==================== NFT | Protocol ====================

export const ProtocolNftMintingRedeemer = Enum("case", {
  Bootstrap: {},
});
export type ProtocolNftMintingRedeemer = Static<
  typeof ProtocolNftMintingRedeemer
>;
