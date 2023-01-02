import {
  Address,
  C,
  fromHex,
  getAddressDetails,
  OutRef,
  toHex,
} from "lucid-cardano";

import * as S from "@/schema";
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

export function constructProjectIdUsingBlake2b(ref: OutRef): Hex {
  const cbor = S.toCbor(S.toData(constructTxOutputId(ref), S.TxOutputId));
  return toHex(C.hash_blake2b256(fromHex(cbor)));
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

  const conPaymentCredential: S.PaymentCredential =
    paymentCredential.type === "Key"
      ? {
          type: "PubKey",
          key: { hash: paymentCredential.hash },
        }
      : {
          type: "Validator",
          script: { hash: paymentCredential.hash },
        };

  const conStakingCredential: S.StakingCredential | null = stakeCredential
    ? {
        kind: "Hash",
        type: "Validator",
        script: { hash: stakeCredential.hash },
      }
    : null;

  return {
    paymentCredential: conPaymentCredential,
    stakingCredential: conStakingCredential,
  };
}

// TODO: We shouldn't rely on this function for transaction building
// We should support other kinds of credential in the future.
export function extractPaymentPubKeyHash(address: S.Address): Hex {
  assert(
    address.paymentCredential.type === "PubKey",
    "Address must have a public-key hash payment credential"
  );
  return address.paymentCredential.key.hash;
}
