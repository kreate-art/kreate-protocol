import { LovelaceAmount } from "@/types";
import { Static } from "@sinclair/typebox";
import { Address } from "lucid-cardano";

import { Enum, Void } from "../uplc";

export const KolourNftMintingRedeemer = Enum("case", {
  Mint: Void,
  Burn: Void,
});
export type KolourNftMintingRedeemer = Static<typeof KolourNftMintingRedeemer>;

export type Kolour = string; // RRGGBB
export type GenesisKreaction = string;

export type KolourEntry = {
  fee: LovelaceAmount;
  listedFee: LovelaceAmount;
  image: string; // ipfs://<cid>
};

export type KolourQuotation = {
  kolours: Record<Kolour, KolourEntry>;
  userAddress: Address;
  feeAddress: Address;
  referral?: string;
  expiration: number; // Unix Timestamp in seconds
};

export type GenesisKreationId = string; // Act as token name also

export type GenesisKreationQuotation = {
  id: GenesisKreationId;
  image: string; // ipfs://<cid>
  fee: LovelaceAmount;
  listedFee: LovelaceAmount;
  userAddress: Address;
  feeAddress: Address;
  referral?: string;
  expiration: number; // Unix Timestamp in seconds
};
