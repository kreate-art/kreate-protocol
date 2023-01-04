import { Address, Lucid, PolicyId, Script, Unit, UTxO } from "lucid-cardano";

import { PROJECT_AT_TOKEN_NAMES } from "@/contracts/common/constants";
import * as S from "@/schema";
import { TxOutputId } from "@/schema";
import { IpfsCid } from "@/schema/teiki/common";
import {
  ProjectDatum,
  ProjectDetailDatum,
  ProjectMintingRedeemer,
  ProjectScriptDatum,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { DedicatedTreasuryDatum } from "@/schema/teiki/treasury";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

import { getCurrentTime } from "../../helpers/lucid";
import {
  constructAddress,
  constructProjectIdUsingBlake2b,
  constructTxOutputId,
} from "../../helpers/schema";
import {
  PROJECT_DETAIL_UTXO_ADA,
  PROJECT_SCRIPT_UTXO_ADA,
  RATIO_MULTIPLIER,
} from "../constants";

export type CreateProjectParams = {
  protocolParamsUtxo: UTxO;
  informationCid: IpfsCid;
  isSponsored: boolean;
  ownerAddress: Address;
  projectAtScriptRefUtxo: UTxO;
  projectATPolicyId: PolicyId;
  projectStakeValidator: Script;
  seedUtxo: UTxO;
  txTimePadding?: TimeDifference;
};

export function createProjectTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    informationCid,
    isSponsored,
    ownerAddress,
    projectAtScriptRefUtxo,
    projectATPolicyId,
    projectStakeValidator,
    seedUtxo,
    txTimePadding = 20000,
  }: CreateProjectParams
) {
  assert(protocolParamsUtxo.datum != null, "Invalid protocol params UTxO");

  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  const projectStakeCredential = lucid.utils.scriptHashToCredential(
    lucid.utils.validatorToScriptHash(projectStakeValidator)
  );

  const projectStakeAddress = lucid.utils.credentialToRewardAddress(
    projectStakeCredential
  );

  const projectAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(
      protocolParams.registry.projectValidator.latest.script.hash
    ),
    projectStakeCredential
  );

  const projectScriptAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(
      protocolParams.registry.projectScriptValidator.latest.script.hash
    ),
    projectStakeCredential
  );

  const projectDetailAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(
      protocolParams.registry.projectDetailValidator.latest.script.hash
    ),
    projectStakeCredential
  );

  const dedicatedTreasuryAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(
      protocolParams.registry.dedicatedTreasuryValidator.latest.script.hash
    ),
    lucid.utils.scriptHashToCredential(
      protocolParams.registry.protocolStakingValidator.script.hash
    )
  );

  const projectATUnit: Unit =
    projectATPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT;
  const projectDetailATUnit: Unit =
    projectATPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT_DETAIL;
  const projectScriptATUnit: Unit =
    projectATPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

  const projectId = constructProjectIdUsingBlake2b(seedUtxo);

  const minTotalFees =
    protocolParams.projectCreationFee +
    (isSponsored ? protocolParams.projectSponsorshipFee : 0n);

  const txTimeStart = getCurrentTime(lucid) - txTimePadding;
  const sponsoredUntil = isSponsored
    ? {
        timestamp:
          protocolParams.projectSponsorshipDuration.milliseconds +
          BigInt(txTimeStart),
      }
    : null;

  const projectScriptDatum: ProjectScriptDatum = {
    projectId: { id: projectId },
    stakingKeyDeposit: protocolParams.stakeKeyDeposit,
  };

  const projectDetailDatum: ProjectDetailDatum = {
    projectId: { id: projectId },
    withdrawnFunds: 0n,
    sponsoredUntil,
    informationCid: informationCid,
    lastCommunityUpdateCid: null,
  };

  const projectDatum: ProjectDatum = {
    projectId: { id: projectId },
    ownerAddress: constructAddress(ownerAddress),
    milestoneReached: 0n,
    isStakingDelegationManagedByProtocol: true,
    status: { type: "Active" },
  };

  const seedTxOutputId: TxOutputId = constructTxOutputId(seedUtxo);

  const dedicatedTreasuryDatum: DedicatedTreasuryDatum = {
    projectId: { id: projectId },
    governorAda:
      (protocolParams.governorShareRatio * minTotalFees) / RATIO_MULTIPLIER,
    tag: { kind: "TagOriginated", seed: seedTxOutputId },
  };

  const projectMintingRedeemer: ProjectMintingRedeemer = {
    case: "NewProject",
    projectSeed: seedTxOutputId,
  };

  let tx = lucid
    .newTx()
    .addSigner(ownerAddress)
    .readFrom([protocolParamsUtxo, projectAtScriptRefUtxo])
    .collectFrom([seedUtxo])
    .mintAssets(
      {
        [projectATUnit]: 1n,
        [projectDetailATUnit]: 1n,
        [projectScriptATUnit]: 1n,
      },
      S.toCbor(S.toData(projectMintingRedeemer, ProjectMintingRedeemer))
    )
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
          protocolParams.projectPledge -
          protocolParams.stakeKeyDeposit -
          PROJECT_DETAIL_UTXO_ADA -
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
    .registerStake(projectStakeAddress);
  if (isSponsored) {
    tx = tx.validFrom(txTimeStart);
  }

  return tx;
}
