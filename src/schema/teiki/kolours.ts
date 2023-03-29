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

export type KolourEntry = {
  fee: LovelaceAmount;
  listedFee: LovelaceAmount;
  image: string; // ipfs://<cid>
};

export type KolourQuotation = KolourQuotationProgram & {
  kolours: Record<Kolour, KolourEntry>;
  userAddress: Address;
  feeAddress: Address;
  expiration: number; // Unix Timestamp in seconds
};

export type KolourQuotationProgram =
  | { source: { type: "present" }; referral?: undefined }
  | { source: { type: "free" }; referral?: undefined }
  | {
      source: { type: "genesis_kreation"; kreation: string };
      referral?: Referral;
    };

export type KolourQuotationSource = KolourQuotationProgram["source"];

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
