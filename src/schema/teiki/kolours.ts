import { Static } from "@sinclair/typebox";
import { Address } from "lucid-cardano";

import { LovelaceAmount } from "@/types";

import { Enum, Void } from "../uplc";

export const KolourNftMintingRedeemer = Enum("case", {
  Mint: Void,
  Burn: Void,
});
export type KolourNftMintingRedeemer = Static<typeof KolourNftMintingRedeemer>;

export type Kolour = string; // RRGGBB

export type Referral = {
  id: string;
  discount: number;
};

// Note that it shouldn't match any pools' ticker
export const FREE_MINT_REFERRAL = {
  id: "FREE",
  discount: 10000,
} as const satisfies Referral;

export type KolourEntry = {
  fee: LovelaceAmount;
  listedFee: LovelaceAmount;
  image: string; // ipfs://<cid>
};

export type KolourQuotation = KolourQuotationProgramme & {
  kolours: Record<Kolour, KolourEntry>;
  userAddress: Address;
  feeAddress: Address;
  expiration: number; // Unix Timestamp in seconds
};

export type KolourQuotationProgramme =
  | { source: "free"; referral: typeof FREE_MINT_REFERRAL }
  | { source: "genesis-kreation"; referral?: Referral };

export type GenesisKreationId = string; // Act as token name also

export type GenesisKreationQuotation = {
  id: GenesisKreationId;
  image: string; // ipfs://<cid>
  fee: LovelaceAmount;
  listedFee: LovelaceAmount;
  userAddress: Address;
  feeAddress: Address;
  referral?: Referral;
  expiration: number; // Unix Timestamp in seconds
};
