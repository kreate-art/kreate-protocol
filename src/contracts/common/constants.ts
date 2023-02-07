import { fromText } from "lucid-cardano";

import {
  INACTIVE_PROJECT_UTXO_ADA,
  PROJECT_CLOSE_DISCOUNT_CENTS,
  PROJECT_DELIST_DISCOUNT_CENTS,
  PROJECT_DETAIL_UTXO_ADA,
  PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO,
  PROJECT_MIN_FUNDS_WITHDRAWAL_ADA,
  PROJECT_NEW_MILESTONE_DISCOUNT_CENTS,
  PROJECT_SCRIPT_CLOSE_DISCOUNT_CENTS,
  PROJECT_SCRIPT_DELIST_DISCOUNT_CENTS,
  PROJECT_SCRIPT_UTXO_ADA,
  RATIO_MULTIPLIER,
  TREASURY_REVOKE_DISCOUNT_CENTS,
  TREASURY_UTXO_MIN_ADA,
  TREASURY_WITHDRAWAL_DISCOUNT_RATIO,
  TREASURY_MIN_WITHDRAWAL_ADA,
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

  const TREASURY_UTXO_MIN_ADA: Int = ${TREASURY_UTXO_MIN_ADA.toString()}

  // TODO: @sk-saru delete this constant when updating contracts done
  const PROJECT_SCRIPT_UTXO_ADA: Int = ${PROJECT_SCRIPT_UTXO_ADA.toString()}

  const RATIO_MULTIPLIER: Int = ${RATIO_MULTIPLIER.toString()}

  // Project constants
  const INACTIVE_PROJECT_UTXO_ADA: Int = ${INACTIVE_PROJECT_UTXO_ADA.toString()}

  const PROJECT_DETAIL_UTXO_ADA: Int = ${PROJECT_DETAIL_UTXO_ADA.toString()}

  const PROJECT_MIN_FUNDS_WITHDRAWAL_ADA: Int = ${PROJECT_MIN_FUNDS_WITHDRAWAL_ADA.toString()}

  const PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO: Int = ${PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO.toString()}

  const PROJECT_NEW_MILESTONE_DISCOUNT_CENTS: Int = ${PROJECT_NEW_MILESTONE_DISCOUNT_CENTS.toString()}

  const PROJECT_CLOSE_DISCOUNT_CENTS: Int = ${PROJECT_CLOSE_DISCOUNT_CENTS.toString()}

  const PROJECT_DELIST_DISCOUNT_CENTS: Int = ${PROJECT_DELIST_DISCOUNT_CENTS.toString()}

  const PROJECT_SCRIPT_CLOSE_DISCOUNT_CENTS: Int = ${PROJECT_SCRIPT_CLOSE_DISCOUNT_CENTS.toString()}

  const PROJECT_SCRIPT_DELIST_DISCOUNT_CENTS: Int = ${PROJECT_SCRIPT_DELIST_DISCOUNT_CENTS.toString()}

  // Backing
  const INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS: Int = ${INACTIVE_BACKING_CLEANUP_DISCOUNT_CENTS.toString()}

  // Treasury
  const TREASURY_MIN_WITHDRAWAL_ADA: Int = ${TREASURY_MIN_WITHDRAWAL_ADA.toString()}

  const TREASURY_WITHDRAWAL_DISCOUNT_RATIO: Int = ${TREASURY_WITHDRAWAL_DISCOUNT_RATIO.toString()}

  const TREASURY_REVOKE_DISCOUNT_CENTS: Int = ${TREASURY_REVOKE_DISCOUNT_CENTS.toString()}
`;
