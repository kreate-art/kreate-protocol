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
import * as S from "@/schema";
import {
  ProtocolNonScriptParams,
  ProtocolParamsDatum,
  Registry,
} from "@/schema/teiki/protocol";
import { getPaymentKeyHash } from "@/transactions/helpers/lucid";

import { constructAddress } from "../helpers/constructors";

export type BootstrapProtocolParams = {
  protocolParams: ProtocolNonScriptParams;
  seedUtxo: UTxO;
  governorAddress: Address;
  poolId: PoolId;
  registry: Registry;
  protocolNftScript: Script;
  protocolParamsAddress: Address;
  protocolProposalAddress: Address;
  protocolStakeAddress: Address;
  protocolStakeValidator: Script;
};

export function bootstrapProtocolTx(
  lucid: Lucid,
  {
    protocolParams,
    seedUtxo,
    governorAddress,
    poolId,
    registry,
    protocolNftScript,
    protocolParamsAddress,
    protocolProposalAddress,
    protocolStakeValidator,
    protocolStakeAddress,
  }: BootstrapProtocolParams
) {
  const protocolParamsDatum: ProtocolParamsDatum = {
    registry,
    governorAddress: constructAddress(governorAddress),
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
    .attachCertificateValidator(protocolStakeValidator);
}
