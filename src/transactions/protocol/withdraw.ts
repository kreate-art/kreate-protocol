import { Address, Data, Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { OpenTreasuryDatum } from "@/schema/teiki/treasury";
import { assert } from "@/utils";

import { RATIO_MULTIPLIER } from "../constants";

export type WithdrawProtocolRewardParams = {
  protocolParamsUtxo: UTxO;
  protocolStakeScriptRefUtxo: UTxO;
  rewards: bigint;
  stakeAddress: Address;
  openTreasuryAddress: Address;
};

export function withdrawProtocolRewardTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    protocolStakeScriptRefUtxo,
    rewards,
    stakeAddress,
    openTreasuryAddress,
  }: WithdrawProtocolRewardParams
) {
  assert(protocolParamsUtxo.datum != null, "Invalid protocol params UTxO");

  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  const openTreasuryDatum: OpenTreasuryDatum = {
    governorAda:
      (rewards * protocolParams.governorShareRatio) / RATIO_MULTIPLIER,
    tag: {
      kind: "TagProtocolStakingRewards",
      stakingValidator: {
        script: protocolParams.registry.protocolStakingValidator.script,
      },
    },
  };

  return lucid
    .newTx()
    .readFrom([protocolParamsUtxo, protocolStakeScriptRefUtxo])
    .withdraw(stakeAddress, rewards, Data.void())
    .payToContract(
      openTreasuryAddress,
      { inline: S.toCbor(S.toData(openTreasuryDatum, OpenTreasuryDatum)) },
      { lovelace: rewards }
    );
}
