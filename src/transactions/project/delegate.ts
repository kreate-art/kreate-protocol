import { Data, Lucid, PoolId, ScriptHash, UTxO } from "lucid-cardano";

import { deconstructAddress } from "@/helpers/schema";
import * as S from "@/schema";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { assert } from "@/utils";

// TODO: @sk-yagi: Batching
export type DelegateProjectParams = {
  protocolParamsUtxo: UTxO;
  allReferencedInputs: UTxO[];
  allProjectStakingValidatorHashes: ScriptHash[];
  poolId: PoolId;
};

export function delegateProjectTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    allReferencedInputs,
    allProjectStakingValidatorHashes,
    poolId,
  }: DelegateProjectParams
) {
  assert(protocolParamsUtxo.datum != null, "Invalid protocol params UTxO");

  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  const governorAddress = deconstructAddress(
    lucid,
    protocolParams.governorAddress
  );

  const allProjectRewardAddresses = allProjectStakingValidatorHashes.map(
    (svh: ScriptHash) => {
      const stakeCredential = lucid.utils.scriptHashToCredential(svh);
      return lucid.utils.credentialToRewardAddress(stakeCredential);
    }
  );

  let tx = lucid
    .newTx()
    .addSigner(governorAddress)
    .readFrom(allReferencedInputs);

  for (const rewardAddress of allProjectRewardAddresses) {
    tx = tx.registerStake(rewardAddress);
    tx = tx.delegateTo(rewardAddress, poolId, Data.void());
  }

  return tx;
}
