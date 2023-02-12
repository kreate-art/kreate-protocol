import { Address, Time, TxOutputId } from "../helios";
import { Bool, Enum, Int, List, Static, Struct, Void } from "../uplc";

import { ProjectId } from "./common";

// ==================== V | Backing ====================

export const BackingDatum = Struct({
  projectId: ProjectId,
  backerAddress: Address,
  backedAt: Time,
  milestoneBacked: Int,
});
export type BackingDatum = Static<typeof BackingDatum>;

export const BackingRedeemer = Enum("case", {
  Unback: Void,
  Migrate: Void,
});
export type BackingRedeemer = Static<typeof BackingRedeemer>;

// ==================== NFT | Proof of Backing ====================

export const Plant = Struct({
  isMatured: Bool,
  backingOutputId: TxOutputId,
  backingAmount: Int,
  unbackedAt: Time,
  projectId: ProjectId,
  backerAddress: Address,
  backedAt: Time,
  milestoneBacked: Int,
});
export type Plant = Static<typeof Plant>;

export const LegacyProofOfBackingMintingRedeemer = Enum("case", {
  Plant: { cleanup: Bool },
  ClaimRewards: { flowers: List(Plant) },
  Migrate: Void,
});
export type LegacyProofOfBackingMintingRedeemer = Static<
  typeof LegacyProofOfBackingMintingRedeemer
>;

export const ProofOfBackingMintingRedeemer = Enum("case", {
  Plant: { cleanup: Bool },
  ClaimRewards: { flowers: List(Plant) },
  MigrateOut: Void,
  MigrateIn: Void,
});
export type ProofOfBackingMintingRedeemer = Static<
  typeof ProofOfBackingMintingRedeemer
>;
