import {
  Address,
  fromHex,
  Lucid,
  PolicyId,
  Script,
  Unit,
  UTxO,
} from "lucid-cardano";

import { PROJECT_AT_TOKEN_NAMES } from "@/contracts/common/constants";
import * as S from "@/schema";
import { IpfsCid } from "@/schema/teiki/common";
import {
  ProjectDatum,
  ProjectDetailDatum,
  ProjectMintingRedeemer,
  ProjectScriptDatum,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { DedicatedTreasuryDatum } from "@/schema/teiki/treasury";

import { PROJECT_DETAIL_UTXO_ADA } from "../helpers/constants";
import {
  constructAddress,
  constructProjectIdUsingBlake2b,
} from "../helpers/constructors";
import { DEFAULT_TIME_PROVIDER, TimeProvider } from "../helpers/time";

export type CreateProjectParams = {
  protocolParamsDatum: ProtocolParamsDatum;
  protocolParamsUtxo: UTxO;
  projectScriptUtxo: UTxO;
  seedUtxo: UTxO;
  isSponsored: boolean;
  informationCid: IpfsCid;
  ownerAddress: Address;
  projectATPolicyId: PolicyId;
  projectAddress: Address;
  projectScriptAddress: Address;
  projectDetailAddress: Address;
  dedicatedTreasuryAddress: Address;
  projectStakeValidator: Script;
  timeProvider?: TimeProvider;
};

export function createProjectTx(
  lucid: Lucid,
  {
    protocolParamsDatum,
    protocolParamsUtxo,
    projectScriptUtxo,
    seedUtxo,
    isSponsored,
    informationCid,
    ownerAddress,
    projectATPolicyId,
    projectAddress,
    projectScriptAddress,
    projectDetailAddress,
    dedicatedTreasuryAddress,
    projectStakeValidator,
    timeProvider = DEFAULT_TIME_PROVIDER,
  }: CreateProjectParams
) {
  // TODO: Move this somewhere else?
  const PROJECT_SCRIPT_UTXO_ADA = 2_000_000n;

  const projectATUnit: Unit =
    projectATPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT;
  const projectDetailATUnit: Unit =
    projectATPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT_DETAIL;
  const projectScriptATUnit: Unit =
    projectATPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

  const projectId = constructProjectIdUsingBlake2b(seedUtxo);

  const minTotalFees =
    protocolParamsDatum.projectCreationFee +
    (isSponsored ? protocolParamsDatum.projectSponsorshipFee : 0n);

  const txTime = timeProvider();
  const sponsoredUntil = isSponsored
    ? protocolParamsDatum.projectSponsorshipDuration.milliseconds +
      BigInt(txTime)
    : null;

  const projectScriptDatum: ProjectScriptDatum = {
    projectId: { id: fromHex(projectId) },
    stakingKeyDeposit: protocolParamsDatum.stakeKeyDeposit,
  };

  const projectDetailDatum: ProjectDetailDatum = {
    projectId: { id: fromHex(projectId) },
    withdrawnFunds: 0n,
    sponsoredUntil: null,
    informationCid: informationCid,
    lastCommunityUpdateCid: null,
  };

  const projectDatum: ProjectDatum = {
    projectId: { id: fromHex(projectId) },
    ownerAddress: constructAddress(ownerAddress),
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
    status: { status: "Active" },
  };

  const dedicatedTreasuryDatum: DedicatedTreasuryDatum = {
    projectId: { id: fromHex(projectId) },
    governorAda: protocolParamsDatum.governorShareRatio * minTotalFees,
    tag: {
      kind: "TagOriginated",
      seed: {
        txId: { $txId: fromHex(seedUtxo.txHash) },
        index: BigInt(seedUtxo.outputIndex),
      },
    },
  };

  const projectMintingRedeemer: ProjectMintingRedeemer = {
    case: "NewProject",
    projectSeed: {
      txId: { $txId: fromHex(seedUtxo.txHash) },
      index: BigInt(seedUtxo.outputIndex),
    },
  };

  let tx = lucid
    .newTx()
    .collectFrom([seedUtxo])
    .addSigner(ownerAddress)
    .mintAssets(
      {
        [projectATUnit]: 1n,
        [projectDetailATUnit]: 1n,
        [projectScriptATUnit]: 1n,
      },
      S.toCbor(S.toData(projectMintingRedeemer, ProjectMintingRedeemer))
    )
    .readFrom([protocolParamsUtxo, projectScriptUtxo])
    .payToContract(
      projectScriptAddress,
      {
        inline: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
        scriptRef: projectStakeValidator,
      },
      {
        [projectScriptATUnit]: 1n,
        lovelace: PROJECT_SCRIPT_UTXO_ADA,
      }
    )
    .payToContract(
      projectDetailAddress,
      { inline: S.toCbor(S.toData(projectDetailDatum, ProjectDetailDatum)) },
      {
        [projectDetailATUnit]: 1n,
        lovelace: PROJECT_DETAIL_UTXO_ADA,
      }
    )
    .payToContract(
      projectAddress,
      { inline: S.toCbor(S.toData(projectDatum, ProjectDatum)) },
      {
        [projectATUnit]: 1n,
        lovelace:
          protocolParamsDatum.projectPledge -
          protocolParamsDatum.stakeKeyDeposit -
          PROJECT_DETAIL_UTXO_ADA +
          PROJECT_SCRIPT_UTXO_ADA,
      }
    )
    .payToContract(
      dedicatedTreasuryAddress,
      {
        inline: S.toCbor(
          S.toData(dedicatedTreasuryDatum, DedicatedTreasuryDatum)
        ),
      },
      { lovelace: minTotalFees }
    )
    .attachCertificateValidator(projectStakeValidator);

  if (sponsoredUntil) {
    tx = tx.validFrom(txTime); // TODO: @sk-umiuma: add txTimePadding...
  }

  return tx;
}
