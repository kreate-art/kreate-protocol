import {
  Address,
  Constr,
  Data,
  Lucid,
  PolicyId,
  PoolId,
  Script,
  Unit,
  UTxO,
} from "lucid-cardano";

import { getProtocolContants } from "@/commands/gen-protocol-params";
import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import * as S from "@/schema";
import { ProtocolParamsDatum, Registry } from "@/schema/teiki/protocol";
import { getPaymentKeyHash } from "@/transactions/helpers/lucid";

import { constructAddress } from "../helpers/constructors";

export type BootstrapProtocolParams = {
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
  const protocolContants = getProtocolContants();

  const protocolParamsDatum: ProtocolParamsDatum = {
    registry,
    governorAddress: constructAddress(governorAddress),
    ...protocolContants,
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
        [paramsNftUnit]: BigInt(1),
        [proposalNftUnit]: BigInt(1),
      },
      Data.to(new Constr(0, []))
    )
    .attachMintingPolicy(protocolNftScript)
    .payToContract(
      protocolParamsAddress,
      { inline: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)) },
      { [paramsNftUnit]: BigInt(1) }
    )
    .payToContract(
      protocolProposalAddress,
      { inline: Data.void() },
      { [proposalNftUnit]: BigInt(1) }
    )
    .registerStake(protocolStakeAddress)
    .delegateTo(protocolStakeAddress, poolId, Data.void())
    .attachCertificateValidator(protocolStakeValidator);
}
