import { Lucid, Script, UTxO } from "lucid-cardano";

import { PROJECT_AT_TOKEN_NAMES } from "@/contracts/common/constants";
import { addressFromScriptHashes } from "@/helpers/lucid";
import * as S from "@/schema";
import {
  ProjectDatum,
  ProjectMintingRedeemer,
  ProjectRedeemer,
  ProjectScriptDatum,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { assert } from "@/utils";

import { PROJECT_SCRIPT_UTXO_ADA } from "../constants";

export type ProjectInfo = {
  projectUtxo: UTxO;
  newStakeValidator: Script;
};

export type Params = {
  protocolParamsUtxo: UTxO;
  projectInfoList: ProjectInfo[];
  projectVRefScriptUtxo: UTxO;
  projectAtMpRefScriptUtxo: UTxO;
};

export function allocateStakingTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectInfoList,
    projectVRefScriptUtxo,
    projectAtMpRefScriptUtxo,
  }: Params
) {
  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );
  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  assert(
    projectAtMpRefScriptUtxo.scriptRef != null,
    "Invalid project AT minting policy reference UTxO: must reference project AT minting policy script"
  );

  const projectAtMph = lucid.utils.validatorToScriptHash(
    projectAtMpRefScriptUtxo.scriptRef
  );
  const projectScriptAtUnit =
    projectAtMph + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;
  const projectMintingRedeemer: ProjectMintingRedeemer = {
    case: "AllocateStaking",
  };

  let tx = lucid
    .newTx()
    .readFrom([
      protocolParamsUtxo,
      projectVRefScriptUtxo,
      projectAtMpRefScriptUtxo,
    ])
    .mintAssets(
      { [projectScriptAtUnit]: BigInt(projectInfoList.length) },
      S.toCbor(S.toData(projectMintingRedeemer, ProjectMintingRedeemer))
    );

  for (const projectInfo of projectInfoList) {
    const projectUtxo = projectInfo.projectUtxo;
    assert(
      projectUtxo.datum != null,
      "Invalid project UTxO: Missing inline datum"
    );

    const projectDatum = S.fromData(
      S.fromCbor(projectUtxo.datum),
      ProjectDatum
    );

    const newStakingValidatorHash = lucid.utils.validatorToScriptHash(
      projectInfo.newStakeValidator
    );
    const projectScriptUtxoAddress = addressFromScriptHashes(
      lucid,
      protocolParams.registry.projectScriptValidator.latest.script.hash,
      newStakingValidatorHash
    );

    const projectScriptDatum: ProjectScriptDatum = {
      projectId: projectDatum.projectId,
      stakingKeyDeposit: protocolParams.stakeKeyDeposit,
    };

    const projectRedeemer: ProjectRedeemer = {
      case: "AllocateStakingValidator",
      newStakingValidator: {
        script: {
          hash: newStakingValidatorHash,
        },
      },
    };

    const newStakeCredential = lucid.utils.scriptHashToCredential(
      lucid.utils.validatorToScriptHash(projectInfo.newStakeValidator)
    );

    const newProjectStakeAddress =
      lucid.utils.credentialToRewardAddress(newStakeCredential);

    tx = tx
      .collectFrom(
        [projectUtxo],
        S.toCbor(S.toData(projectRedeemer, ProjectRedeemer))
      )
      .payToContract(
        projectUtxo.address,
        { inline: projectUtxo.datum },
        {
          ...projectUtxo.assets,
          lovelace:
            BigInt(projectUtxo.assets.lovelace) -
            protocolParams.stakeKeyDeposit -
            PROJECT_SCRIPT_UTXO_ADA,
        }
      )
      .payToContract(
        projectScriptUtxoAddress,
        {
          inline: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
          scriptRef: projectInfo.newStakeValidator,
        },
        {
          lovelace: PROJECT_SCRIPT_UTXO_ADA,
          [projectScriptAtUnit]: 1n,
        }
      )
      .registerStake(newProjectStakeAddress);
  }

  return tx;
}
