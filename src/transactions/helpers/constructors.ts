import {
  Address,
  C,
  fromHex,
  OutRef,
  toHex,
  getAddressDetails,
} from "lucid-cardano";

import * as S from "@/schema";
import { MigratableScript } from "@/schema/teiki/protocol";
import { Hex } from "@/types";
import { assert } from "@/utils";

// TODO: Extract to a constructors module

export function constructProjectIdUsingBlake2b({
  txHash,
  outputIndex,
}: OutRef): Hex {
  const outputId: S.TxOutputId = {
    txId: { $txId: txHash },
    index: BigInt(outputIndex),
  };
  const cbor = S.toCbor(S.toData(outputId, S.TxOutputId));
  return toHex(C.hash_blake2b256(fromHex(cbor)));
}

export function constructScriptHash(hash: Hex): S.ScriptHash {
  return { scriptHash: { $hash: hash } };
}

export function constructAssetClass(
  mintingPolicyHash: Hex,
  tokenName: Hex
): S.AssetClass {
  return {
    mintingPolicyHash: constructScriptHash(mintingPolicyHash),
    tokenName: tokenName,
  };
}

export function constructMigratableScript(
  latestScriptHash: Hex,
  migrations: Record<Hex, { mintingPolicyHash: Hex; tokenName: Hex }>
): MigratableScript {
  return {
    latest: { scriptHash: { $hash: latestScriptHash } },
    migrations: new Map(
      Object.entries(migrations).map(
        ([migratingScriptHash, { mintingPolicyHash, tokenName }]) => [
          constructScriptHash(migratingScriptHash),
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
          paymentType: "PubKey",
          $: { pubKeyHash: { $hash: paymentCredential.hash } },
        }
      : {
          paymentType: "Validator",
          $: { scriptHash: { $hash: paymentCredential.hash } },
        };

  const conStakingCredential: S.StakingCredential | null = stakeCredential
    ? {
        stakingType: "Hash",
        $: {
          stakingHash: "Validator",
          $: { scriptHash: { $hash: stakeCredential.hash } },
        },
      }
    : null;

  return {
    paymentCredential: conPaymentCredential,
    stakingCredential: conStakingCredential,
  };
}
