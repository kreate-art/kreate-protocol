import {
  Address,
  C,
  Credential,
  fromHex,
  getAddressDetails,
  Lucid,
  OutRef,
  toHex,
} from "lucid-cardano";

import * as S from "@/schema";
import { Plant } from "@/schema/teiki/backing";
import { MigratableScript } from "@/schema/teiki/protocol";
import { Hex } from "@/types";
import { assert } from "@/utils";

export function constructTxOutputId({
  txHash,
  outputIndex,
}: OutRef): S.TxOutputId {
  return {
    txId: txHash,
    index: BigInt(outputIndex),
  };
}

export function constructPlantHashUsingBlake2b(plant: Plant) {
  const cbor = S.toCbor(S.toData(plant, Plant));
  return hashBlake2b256(cbor);
}

export function constructProjectIdUsingBlake2b(ref: OutRef): Hex {
  const cbor = S.toCbor(S.toData(constructTxOutputId(ref), S.TxOutputId));
  return hashBlake2b256(cbor);
}

export function constructAssetClass(
  mintingPolicyHash: Hex,
  tokenName: Hex
): S.AssetClass {
  return {
    mintingPolicyHash: { script: { hash: mintingPolicyHash } },
    tokenName: tokenName,
  };
}

export function constructMigratableScript(
  latestScriptHash: Hex,
  migrations: Record<Hex, { mintingPolicyHash: Hex; tokenName: Hex }>
): MigratableScript {
  return {
    latest: { script: { hash: latestScriptHash } },
    migrations: new Map(
      Object.entries(migrations).map(
        ([migratingScriptHash, { mintingPolicyHash, tokenName }]) => [
          { script: { hash: migratingScriptHash } },
          constructAssetClass(mintingPolicyHash, tokenName),
        ]
      )
    ),
  };
}

export function constructAddress(address: Address): S.Address {
  const { paymentCredential, stakeCredential } = getAddressDetails(address);
  assert(paymentCredential, "Cannot extract payment credential from address");
  const scPaymentCredential: S.PaymentCredential =
    paymentCredential.type === "Key"
      ? { type: "PubKey", key: { hash: paymentCredential.hash } }
      : { type: "Validator", script: { hash: paymentCredential.hash } };
  const scStakingCredential: S.StakingCredential | null = stakeCredential
    ? stakeCredential.type === "Key"
      ? {
          kind: "Hash",
          type: "StakeKey",
          key: { hash: stakeCredential.hash },
        }
      : {
          kind: "Hash",
          type: "Validator",
          script: { hash: stakeCredential.hash },
        }
    : null;
  return {
    paymentCredential: scPaymentCredential,
    stakingCredential: scStakingCredential,
  };
}

// TODO: We shouldn't rely on this function for transaction building
// We should support other kinds of credential in the future.
export function extractPaymentPubKeyHash(scAddress: S.Address): Hex {
  const { paymentCredential } = scAddress;
  assert(
    paymentCredential.type === "PubKey",
    "Address must have a public-key hash payment credential"
  );
  return paymentCredential.key.hash;
}

export function deconstructAddress(
  lucid: Lucid,
  scAddress: S.Address
): Address {
  const { paymentCredential, stakingCredential } = scAddress;
  const lcPaymentCredential: Credential =
    paymentCredential.type === "PubKey"
      ? { type: "Key", hash: paymentCredential.key.hash }
      : { type: "Script", hash: paymentCredential.script.hash };
  const lcStakingCredential: Credential | undefined =
    stakingCredential && stakingCredential.kind === "Hash"
      ? stakingCredential.type === "StakeKey"
        ? { type: "Key", hash: stakingCredential.key.hash }
        : { type: "Script", hash: stakingCredential.script.hash }
      : undefined;
  return lucid.utils.credentialToAddress(
    lcPaymentCredential,
    lcStakingCredential
  );
}

export function hashBlake2b256(cbor: Hex): Hex {
  return toHex(C.hash_blake2b256(fromHex(cbor)));
}
