import {
  Address,
  Data,
  Lucid,
  PolicyId,
  PoolId,
  Script,
  Unit,
  UTxO,
} from "lucid-cardano";

import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { getPaymentKeyHash } from "@/helpers/lucid";
import * as S from "@/schema";
import {
  ProtocolNonScriptParams,
  ProtocolParamsDatum,
  Registry,
} from "@/schema/teiki/protocol";
import { TimeDifference, UnixTime } from "@/types";

import { constructAddress } from "../../helpers/schema";

export type BootstrapProtocolParams = {
  protocolParams: ProtocolNonScriptParams;
  seedUtxo: UTxO;
  governorAddress: Address;
  stakingManagerAddress: Address;
  poolId: PoolId;
  registry: Registry;
  protocolNftScript: Script;
  protocolParamsAddress: Address;
  protocolProposalAddress: Address;
  protocolStakeAddress: Address;
  protocolStakeValidator: Script;
  txTime: UnixTime;
  txTtl?: TimeDifference;
};

export function bootstrapProtocolTx(
  lucid: Lucid,
  {
    protocolParams,
    seedUtxo,
    governorAddress,
    stakingManagerAddress,
    poolId,
    registry,
    protocolNftScript,
    protocolParamsAddress,
    protocolProposalAddress,
    protocolStakeValidator,
    protocolStakeAddress,
    txTime,
    txTtl = 600_000,
  }: BootstrapProtocolParams
) {
  const protocolParamsDatum: ProtocolParamsDatum = {
    registry,
    governorAddress: constructAddress(governorAddress),
    stakingManager: constructAddress(stakingManagerAddress).paymentCredential,
    ...protocolParams,
  };

  const protocolNftPolicyId: PolicyId =
    lucid.utils.mintingPolicyToId(protocolNftScript);

  const paramsNftUnit: Unit =
    protocolNftPolicyId + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;
  const proposalNftUnit: Unit =
    protocolNftPolicyId + PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL;

  return lucid
    .newTx()
    .addSignerKey(getPaymentKeyHash(governorAddress))
    .collectFrom([seedUtxo])
    .mintAssets(
      {
        [paramsNftUnit]: 1n,
        [proposalNftUnit]: 1n,
      },
      Data.void()
    )
    .attachMintingPolicy(protocolNftScript)
    .payToContract(
      protocolParamsAddress,
      { inline: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)) },
      { [paramsNftUnit]: 1n }
    )
    .payToContract(
      protocolProposalAddress,
      { inline: Data.void() },
      { [proposalNftUnit]: 1n }
    )
    .registerStake(protocolStakeAddress)
    .delegateTo(protocolStakeAddress, poolId, Data.void())
    .attachCertificateValidator(protocolStakeValidator)
    .validFrom(txTime)
    .validTo(txTime + txTtl);
}
