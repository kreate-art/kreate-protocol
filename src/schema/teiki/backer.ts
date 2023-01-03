import { Address, Time, TxOutputId } from "../helios";
import { Bool, Enum, Int, List, Static, Struct, Void } from "../uplc";

import { ProjectId } from "./common";

// ==================== V | Backing ====================

export const BackingDatum = Struct({
  projectId: ProjectId,
  backerAddress: Address,
  stakedAt: Time,
  milestoneBacked: Int,
});
export type BackingDatum = Static<typeof BackingDatum>;

export const BackingRedeemer = Enum("case", {
  Unstake: Void,
  Migrate: Void,
});
export type BackingRedeemer = Static<typeof BackingRedeemer>;

// ==================== NFT | Proof of Backing ====================

export const Plant = Struct({
  isMature: Bool,
  backingOutputId: TxOutputId,
  backingAmount: Int,
  unstakedAt: Time,
  projectId: ProjectId,
  backerAddress: Address,
  stakedAt: Time,
  milestoneBacked: Int,
});
export type Plant = Static<typeof Plant>;

export const ProofOfBackingMintingRedeemer = Enum("case", {
  Plant: { cleanup: Bool },
  ClaimRewards: { flowers: List(Plant) },
  Migrate: Void,
});
export type ProofOfBackingMintingRedeemer = Static<
  typeof ProofOfBackingMintingRedeemer
>;
