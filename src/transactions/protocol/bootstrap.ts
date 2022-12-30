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

import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { getPaymentKeyHash } from "@/lucid";
import * as S from "@/schema";
import {
  MigratableScript,
  ProtocolParamsDatum,
  Registry,
} from "@/schema/teiki/protocol";

import {
  constructAddress,
  constructMigratableScript,
  constructScriptHash,
} from "../helpers/constructors";

export type RegistryScript = {
  protocolStakeValidatorHash: string;
  projectValidatorHash: string;
  projectDetailValidatorHash: string;
  projectScriptValidatorHash: string;
  backingValidatorHash: string;
  dedicatedTreasuryValidatorHash: string;
  sharedTreasuryValidatorHash: string;
  openTreasuryValidatorHash: string;
};

export type BootstrapProtocolParams = {
  seedUtxo: UTxO;
  governorAddress: Address;
  poolId: PoolId;
  teikiPlantNftMPH: string;
  migrateTokenMPH: string;
  migrateTokenName: string;
  registryScript: RegistryScript;
  protocolNftPolicy: Script;
  protocolParamsAddress: Address;
  protocolProposalAddress: Address;
  protocolStakeAddress: Address;
  protocolStakeValidator: Script;
};

function getMigratableScript(
  validatorHash: string,
  migrateTokenMPH: string,
  migrateTokenName: string
): MigratableScript {
  return constructMigratableScript(validatorHash, {
    [validatorHash]: {
      mintingPolicyHash: migrateTokenMPH,
      tokenName: migrateTokenName,
    },
  });
}

export function bootstrapProtocolTx(
  lucid: Lucid,
  {
    seedUtxo,
    governorAddress,
    poolId,
    registryScript,
    migrateTokenMPH,
    migrateTokenName,
    protocolNftPolicy,
    protocolParamsAddress,
    protocolProposalAddress,
    protocolStakeValidator,
    protocolStakeAddress,
  }: BootstrapProtocolParams
) {
  const registry: Registry = {
    protocolStakingValidator: constructScriptHash(
      registryScript.protocolStakeValidatorHash
    ),
    projectValidator: getMigratableScript(
      registryScript.projectValidatorHash,
      migrateTokenMPH,
      migrateTokenName
    ),
    projectDetailValidator: getMigratableScript(
      registryScript.projectDetailValidatorHash,
      migrateTokenMPH,
      migrateTokenName
    ),
    projectScriptValidator: getMigratableScript(
      registryScript.projectScriptValidatorHash,
      migrateTokenMPH,
      migrateTokenName
    ),
    backingValidator: getMigratableScript(
      registryScript.backingValidatorHash,
      migrateTokenMPH,
      migrateTokenName
    ),
    dedicatedTreasuryValidator: getMigratableScript(
      registryScript.dedicatedTreasuryValidatorHash,
      migrateTokenMPH,
      migrateTokenName
    ),
    sharedTreasuryValidator: getMigratableScript(
      registryScript.sharedTreasuryValidatorHash,
      migrateTokenMPH,
      migrateTokenName
    ),
    openTreasuryValidator: getMigratableScript(
      registryScript.openTreasuryValidatorHash,
      migrateTokenMPH,
      migrateTokenName
    ),
  };

  // TODO: @sk-saru fix protocol constants
  const protocolParamsDatum: ProtocolParamsDatum = {
    registry,
    governorAddress: constructAddress(governorAddress),
    governorShareRatio: 600_000n,
    protocolFundsShareRatio: 600_000n,
    discountCentPrice: 10_000n,
    projectMilestones: [1_000_000n, 10_000_000n, 100_000_000n],
    teikiCoefficient: 500n,
    projectTeikiBurnRate: 600_000n,
    epochLength: { milliseconds: 10_000n },
    projectPledge: 50_000_000n,
    projectCreationFee: 20_000_000n,
    projectSponsorshipFee: 10_000_000n,
    projectSponsorshipDuration: { milliseconds: 10_000n },
    projectInformationUpdateFee: 10_000_000n,
    projectCommunityUpdateFee: 10_000_000n,
    minTreasuryPerMilestoneEvent: 20_000_000n,
    stakeKeyDeposit: 30_000_000n,
    proposalWaitingPeriod: { milliseconds: 10_000n },
    projectDelistWaitingPeriod: { milliseconds: 10_000n },
  };

  const protocolNftPolicyId: PolicyId =
    lucid.utils.mintingPolicyToId(protocolNftPolicy);

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
    .attachMintingPolicy(protocolNftPolicy)
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
