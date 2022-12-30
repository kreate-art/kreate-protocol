import { Address, C, fromHex, Lucid, OutRef, toHex } from "lucid-cardano";

import * as S from "@/schema";
import { MigratableScript } from "@/schema/teiki/protocol";
import { Hex } from "@/types";

export function getPaymentHashFromAddress(lucid: Lucid, address: Address): Hex {
  const addressDetails = lucid.utils.getAddressDetails(address);
  if (!addressDetails.paymentCredential)
    throw new Error("Cannot extract payment hash from the address");
  return addressDetails.paymentCredential.hash;
}

// TODO: Extract to a constructors module

export function constructProjectIdUsingBlake2b({
  txHash,
  outputIndex,
}: OutRef): Hex {
  const outputId: S.TxOutputId = {
    txId: { $txId: fromHex(txHash) },
    index: BigInt(outputIndex),
  };
  const cbor = S.toCbor(S.toData(outputId, S.TxOutputId));
  return toHex(C.hash_blake2b256(fromHex(cbor)));
}

export function constructScriptHash(hash: Hex): S.ScriptHash {
  return { scriptHash: { $hash: fromHex(hash) } };
}

export function constructAssetClass(
  mintingPolicyHash: Hex,
  tokenName: Hex
): S.AssetClass {
  return {
    mintingPolicyHash: constructScriptHash(mintingPolicyHash),
    tokenName: fromHex(tokenName),
  };
}

export function constructMigratableScript(
  latestScriptHash: Hex,
  migrations: Record<Hex, { mintingPolicyHash: Hex; tokenName: Hex }>
): MigratableScript {
  return {
    latest: {
      scriptHash: {
        $hash: fromHex(latestScriptHash),
      },
    },
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

// TODO: not compatible types
export function constructAddress(
  pubKeyHash: string,
  stakingKeyHash?: string
): S.Address {
  return {
    paymentCredential: {
      paymentType: "PubKey",
      $: { pubKeyHash: { $hash: fromHex(pubKeyHash) } },
    },
    stakingCredential: stakingKeyHash
      ? {
          stakingType: "Hash",
          $: {
            stakingHash: "Validator",
            $: { scriptHash: { $hash: fromHex(stakingKeyHash) } },
          },
        }
      : null,
  };
}