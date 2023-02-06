import { fromText } from "lucid-cardano";

import {
  PROJECT_SCRIPT_UTXO_ADA,
  TREASURY_WITHDRAWAL_DISCOUNT_RATIO,
  TREAUSRY_MIN_WITHDRAWAL_ADA,
} from "@/transactions/constants";
import { Hex } from "@/types";

import { helios } from "../program";

// FIXME: Redo this module...

export const PROTOCOL_NFT_TOKEN_NAMES: Record<string, Hex> = Object.fromEntries(
  Object.entries({
    PARAMS: "params",
    PROPOSAL: "proposal",
  }).map(([k, v]) => [k, fromText(v)])
);

export const PROJECT_AT_TOKEN_NAMES: Record<string, Hex> = Object.fromEntries(
  Object.entries({
    PROJECT: "project",
    PROJECT_DETAIL: "project-detail",
    PROJECT_SCRIPT: "project-script",
  }).map(([k, v]) => [k, fromText(v)])
);

export const PROOF_OF_BACKING_TOKEN_NAMES: Record<string, Hex> =
  Object.fromEntries(
    Object.entries({
      SEED: "seed",
      WILTED_FLOWER: "wilted-flower",
    }).map(([k, v]) => [k, fromText(v)])
  );

export const TEIKI_TOKEN_NAME: Hex = fromText("teiki");

export const TEIKI_PLANT_NFT_TOKEN_NAME: Hex = fromText("teiki-plant");

export const MIGRATE_TOKEN_NAME: Hex = fromText("migration");

export const INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS = 20n;

export default helios("constants")`
  module constants

  const ADA_MINTING_POLICY_HASH: MintingPolicyHash = MintingPolicyHash::new(#)

  const ADA_TOKEN_NAME: ByteArray = #

  const PROTOCOL_PARAMS_NFT_TOKEN_NAME: ByteArray =
    #${PROTOCOL_NFT_TOKEN_NAMES.PARAMS}

  const PROTOCOL_PROPOSAL_NFT_TOKEN_NAME: ByteArray =
    #${PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL}

  const PROJECT_AT_TOKEN_NAME: ByteArray =
    #${PROJECT_AT_TOKEN_NAMES.PROJECT}

  const PROJECT_DETAIL_AT_TOKEN_NAME: ByteArray =
    #${PROJECT_AT_TOKEN_NAMES.PROJECT_DETAIL}

  const PROJECT_SCRIPT_AT_TOKEN_NAME: ByteArray =
    #${PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT}

  const TEIKI_TOKEN_NAME: ByteArray = #${TEIKI_TOKEN_NAME}

  const TEIKI_PLANT_NFT_TOKEN_NAME: ByteArray = #${TEIKI_PLANT_NFT_TOKEN_NAME}

  const TREASURY_UTXO_MIN_ADA: Int = 2000000

  // TODO: @sk-saru delete this constant when updating contracts done
  const PROJECT_SCRIPT_UTXO_ADA: Int = ${PROJECT_SCRIPT_UTXO_ADA.toString()}

  const MULTIPLIER: Int = 1000000

  const MIN_FUNDS_WITHDRAWAL_ADA: Int = 1000000000

  // Project constants
  const INACTIVE_PROJECT_UTXO_ADA: Int = 2000000

  const PROJECT_DETAIL_UTXO_ADA: Int = 2000000

  const PROJECT_MIN_FUNDS_WITHDRAWAL_ADA: Int = 100000000

  const PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO: Int = 10000

  const PROJECT_NEW_MILESTONE_DISCOUNT_CENTS: Int = 1000000

  const PROJECT_CLOSE_DISCOUNT_CENTS: Int = 500000

  const PROJECT_DELIST_DISCOUNT_CENTS: Int = 500000

  const PROJECT_SCRIPT_CLOSE_DISCOUNT_CENTS: Int = 500000

  const PROJECT_SCRIPT_DELIST_DISCOUNT_CENTS: Int = 500000

  // Backing
  const INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS: Int = ${INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS.toString()}

  // Treasury
  const TREASURY_MIN_WITHDRAWAL_ADA: Int = ${TREAUSRY_MIN_WITHDRAWAL_ADA.toString()}

  const TREASURY_WITHDRAWAL_DISCOUNT_RATIO: Int = ${TREASURY_WITHDRAWAL_DISCOUNT_RATIO.toString()}

  const TREASURY_REVOKE_DISCOUNT_CENTS: Int = 500000
`;
