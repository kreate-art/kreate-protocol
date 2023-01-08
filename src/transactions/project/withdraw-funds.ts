import { Address, Data, Lucid, Redeemer, UTxO } from "lucid-cardano";

import { ProjectDatum, ProjectDetailDatum } from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { DedicatedTreasuryDatum } from "@/schema/teiki/treasury";

import {
  PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO,
  PROJECT_NEW_MILESTONE_DISCOUNT_CENTS,
  TREASURY_UTXO_MIN_ADA,
} from "../constants";

type Actor = "project-owner" | "anyone";

export type WithdrawFundsParams = {
  protocolParamsDatum: ProtocolParamsDatum;
  protocolParamsUtxo: UTxO;
  projectStakingScriptUtxos: UTxO[];
  projectDetailDatum: ProjectDetailDatum;
  projectDetailUtxo: UTxO;
  projectDatum: ProjectDatum;
  projectUtxo: UTxO;
  projectStakingScriptUtxo: UTxO;
  dedicatedTreasuryDatum: DedicatedTreasuryDatum;
  dedicatedTreasuryUtxo: UTxO;
  totalWithdrawal: bigint;
  sharedTreasuryAddress: Address;
  actor: Actor;
};

// TODO: @sk-umiuma: Add the commented params
export function withdrawFundsTx(
  lucid: Lucid,
  {
    protocolParamsDatum,
    protocolParamsUtxo,
    projectStakingScriptUtxos,
    projectDetailDatum,
    projectDetailUtxo,
    projectDatum,
    projectUtxo,
    projectStakingScriptUtxo,
    // dedicatedTreasuryDatum,
    dedicatedTreasuryUtxo,
    totalWithdrawal,
    sharedTreasuryAddress,
    actor,
  }: WithdrawFundsParams
) {
  if (!projectStakingScriptUtxo.scriptRef) {
    throw new Error("Invalid staking validator script reference");
  }

  const rewardAddress = lucid.utils.credentialToRewardAddress(
    lucid.utils.scriptHashToCredential(
      lucid.utils.validatorToScriptHash(projectStakingScriptUtxo.scriptRef)
    )
  );

  const fees = totalWithdrawal * protocolParamsDatum.protocolFundsShareRatio;
  const newWithdrawnFunds = projectDetailDatum.withdrawnFunds + totalWithdrawal;
  const milestone =
    protocolParamsDatum.projectMilestones.length -
    protocolParamsDatum.projectMilestones
      .reverse()
      .findIndex((value) => value <= newWithdrawnFunds);
  const isNewMilestoneReached = milestone > projectDatum.milestoneReached;

  // TODO: @sk-umiuma: Implement this
  const dedicatedTreasuryRedeemer: Redeemer = Data.void();
  // TODO: @sk-umiuma: Implement this
  const projectDetailRedeemer: Redeemer = Data.void();
  // TODO: @sk-umiuma: Implement this
  const stakingScriptRedeemer: Redeemer = Data.void();

  let tx = lucid
    .newTx()
    .readFrom([
      protocolParamsUtxo,
      projectStakingScriptUtxo,
      ...projectStakingScriptUtxos,
    ])
    .withdraw(rewardAddress, totalWithdrawal, stakingScriptRedeemer)
    .collectFrom([dedicatedTreasuryUtxo], dedicatedTreasuryRedeemer)
    .collectFrom([projectDetailUtxo], projectDetailRedeemer)
    .payToContract(
      projectDetailUtxo.address,
      { inline: Data.void() }, // FIXME:
      projectDetailUtxo.assets
    );

  if (isNewMilestoneReached) {
    // TODO: @sk-umiuma: Implement this
    const projectRedeemer: Redeemer = Data.void();
    tx = tx
      .collectFrom([projectUtxo], projectRedeemer)
      .payToContract(
        projectUtxo.address,
        { inline: Data.void() }, // FIXME:
        projectUtxo.assets
      )
      .payToContract(
        dedicatedTreasuryUtxo.address,
        { inline: Data.void() }, // FIXME:
        { lovelace: dedicatedTreasuryUtxo.assets.lovelace + fees }
      );

    for (let i = 0; i < protocolParamsDatum.minTreasuryPerMilestoneEvent; ++i) {
      tx = tx.payToContract(
        sharedTreasuryAddress,
        { inline: Data.void() }, // FIXME:
        { lovelace: TREASURY_UTXO_MIN_ADA }
      );
    }
  } else {
    tx = tx.readFrom([projectUtxo]).payToContract(
      dedicatedTreasuryUtxo.address,
      { inline: Data.void() }, // FIXME:
      { lovelace: dedicatedTreasuryUtxo.assets.lovelace + fees }
    );
  }

  if (actor !== "project-owner") {
    let discount = PROJECT_FUNDS_WITHDRAWAL_DISCOUNT_RATIO * totalWithdrawal;
    if (isNewMilestoneReached) {
      discount +=
        protocolParamsDatum.discountCentPrice *
        PROJECT_NEW_MILESTONE_DISCOUNT_CENTS;
    }

    tx = tx.payToContract(
      "", // FIXME:
      { inline: Data.void() }, // FIXME:
      { lovelace: totalWithdrawal - fees - discount }
    );
  }

  return tx;
}
