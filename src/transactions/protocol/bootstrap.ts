import {
  Address,
  Constr,
  Data,
  Lucid,
  PolicyId,
  Script,
  Unit,
  UTxO,
} from "lucid-cardano";

import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import * as S from "@/schema";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";

export type BootstrapProtocolParams = {
  protocolParamsDatum: ProtocolParamsDatum;
  seedUtxo: UTxO;
  protocolNftPolicy: Script;
  protocolParamsAddress: Address;
  protocolProposalAddress: Address;
};

export function bootstrapProtocolTx(
  lucid: Lucid,
  {
    protocolParamsDatum,
    seedUtxo,
    protocolNftPolicy,
    protocolParamsAddress,
    protocolProposalAddress,
  }: BootstrapProtocolParams
) {
  const protocolNftPolicyId: PolicyId =
    lucid.utils.mintingPolicyToId(protocolNftPolicy);

  const paramsNftUnit: Unit =
    protocolNftPolicyId + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;
  const proposalNftUnit: Unit =
    protocolNftPolicyId + PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL;

  return lucid
    .newTx()
    .collectFrom([seedUtxo])
    .mintAssets(
      {
        [paramsNftUnit]: BigInt(1),
        [proposalNftUnit]: BigInt(1),
      },
      Data.to(new Constr(0, []))
    )
    .attachMintingPolicy(protocolNftPolicy)
    .payToContract(
      protocolParamsAddress,
      { inline: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)) },
      { [paramsNftUnit]: BigInt(1) }
    )
    .payToContract(
      protocolProposalAddress,
      { inline: Data.empty() },
      { [proposalNftUnit]: BigInt(1) }
    );
}
