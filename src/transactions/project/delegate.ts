import { Address, Data, Lucid, PoolId, UTxO } from "lucid-cardano";

import { assert } from "@/utils";

// TODO: @sk-yagi: Batching
export type DelegateProjectParams = {
  protocolParamsUtxo: UTxO;
  allGenericSomething: GenericDelegateProjectParams[];
  poolId: PoolId;
};

// TODO: Better naming!!!
export type GenericDelegateProjectParams = {
  projectUtxo: UTxO;
  projectScriptVScriptUtxo: UTxO;
  authorizedAddress: Address; // Either `StakingManager` or `GovernorAddress`
};

export function delegateProjectTx(
  lucid: Lucid,
  { protocolParamsUtxo, allGenericSomething, poolId }: DelegateProjectParams
) {
  let tx = lucid.newTx().readFrom([protocolParamsUtxo]);

  for (const txParams of allGenericSomething) {
    assert(
      txParams.projectScriptVScriptUtxo.scriptRef != null,
      "Invalid project script UTxO"
    );

    const projectSvScriptHash = lucid.utils.validatorToScriptHash(
      txParams.projectScriptVScriptUtxo.scriptRef
    );

    const projectStakingCredential =
      lucid.utils.scriptHashToCredential(projectSvScriptHash);
    const rewardAddress = lucid.utils.credentialToRewardAddress(
      projectStakingCredential
    );

    tx = tx.addSigner(txParams.authorizedAddress);
    tx = tx.readFrom([txParams.projectUtxo, txParams.projectScriptVScriptUtxo]);
    tx = tx.registerStake(rewardAddress);
    tx = tx.delegateTo(rewardAddress, poolId, Data.void());
  }

  return tx;
}
