import { Address, Data, Lucid, PoolId, UTxO } from "lucid-cardano";

import { assert } from "@/utils";

// TODO: @sk-yagi: Batching
export type DelegateProjectParams = {
  protocolParamsUtxo: UTxO;
  authorizedAddress: Address; // Either `StakingManager` or `GovernorAddress`
  allDelegatedProjects: DelegateProjectStaking[];
  poolId: PoolId;
};

export type DelegateProjectStaking = {
  projectUtxo: UTxO;
  projectScriptUtxo: UTxO;
};

export function delegateProjectTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    authorizedAddress,
    allDelegatedProjects,
    poolId,
  }: DelegateProjectParams
) {
  let tx = lucid.newTx().readFrom([protocolParamsUtxo]);

  for (const project of allDelegatedProjects) {
    assert(
      project.projectScriptUtxo.scriptRef != null,
      "Invalid project script UTxO"
    );

    const projectSvScriptHash = lucid.utils.validatorToScriptHash(
      project.projectScriptUtxo.scriptRef
    );

    const projectStakingCredential =
      lucid.utils.scriptHashToCredential(projectSvScriptHash);
    const rewardAddress = lucid.utils.credentialToRewardAddress(
      projectStakingCredential
    );

    tx = tx
      .addSigner(authorizedAddress)
      .readFrom([project.projectUtxo, project.projectScriptUtxo])
      .delegateTo(rewardAddress, poolId, Data.void());
  }

  return tx;
}
