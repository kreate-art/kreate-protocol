import { Lucid, UTxO } from "lucid-cardano";

import { constructTxOutputId, deconstructAddress } from "@/helpers/schema";
import * as S from "@/schema";
import { IpfsCid } from "@/schema/teiki/common";
import {
  ProjectDatum,
  ProjectDetailDatum,
  ProjectDetailRedeemer,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import {
  DedicatedTreasuryDatum,
  DedicatedTreasuryRedeemer,
} from "@/schema/teiki/treasury";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

import { getTime } from "../../helpers/time";
import { RATIO_MULTIPLIER } from "../constants";

export type UpdateProjectParams = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  projectDetailUtxo: UTxO;
  dedicatedTreasuryUtxo: UTxO;
  projectDetailVScriptUtxo: UTxO;
  dedicatedTreasuryVScriptUtxo: UTxO;
  shouldExtendSponsorship: boolean;
  newInformationCid?: IpfsCid;
  newCommunityUpdateCid?: IpfsCid;
  txTimePadding?: TimeDifference;
};

// TODO: @sk-umiuma: Add the commented params
export function updateProjectTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    dedicatedTreasuryUtxo,
    projectDetailVScriptUtxo,
    dedicatedTreasuryVScriptUtxo,
    shouldExtendSponsorship,
    newInformationCid,
    newCommunityUpdateCid,
    txTimePadding = 20000,
  }: UpdateProjectParams
) {
  assert(
    projectDetailVScriptUtxo.scriptRef != null,
    "Invalid project detail script UTxO: Missing script reference"
  );

  assert(
    dedicatedTreasuryVScriptUtxo.scriptRef != null,
    "Invalid dedicated treasury script UTxO: Missing script reference"
  );

  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );
  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  assert(
    projectUtxo.datum != null,
    "Invalid project UTxO: Missing inline datum"
  );
  const project = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  assert(
    projectDetailUtxo.datum != null,
    "Invalid project detail UTxO: Missing inline datum"
  );
  const projectDetail = S.fromData(
    S.fromCbor(projectDetailUtxo.datum),
    ProjectDetailDatum
  );

  assert(
    dedicatedTreasuryUtxo.datum != null,
    "Invalid dedicated treasury UTxO: Missing inline datum"
  );
  const dedicatedTreasury = S.fromData(
    S.fromCbor(dedicatedTreasuryUtxo.datum),
    DedicatedTreasuryDatum
  );

  let minTotalFees = 0n;

  if (shouldExtendSponsorship) {
    minTotalFees += protocolParams.projectSponsorshipFee;
  }

  if (
    newInformationCid?.cid &&
    newInformationCid.cid !== projectDetail.informationCid.cid
  ) {
    minTotalFees += protocolParams.projectInformationUpdateFee;
  }

  if (
    newCommunityUpdateCid?.cid &&
    newCommunityUpdateCid.cid !== projectDetail.lastCommunityUpdateCid?.cid
  ) {
    minTotalFees += protocolParams.projectCommunityUpdateFee;
  }

  const txTime = getTime({ lucid }) - txTimePadding;

  const newProjectDetail: ProjectDetailDatum = {
    ...projectDetail,
    sponsoredUntil: shouldExtendSponsorship
      ? {
          timestamp:
            BigInt(
              Math.max(
                Number(projectDetail.sponsoredUntil?.timestamp ?? 0),
                txTime
              )
            ) + protocolParams.projectSponsorshipDuration.milliseconds,
        }
      : projectDetail.sponsoredUntil,
    informationCid: newInformationCid ?? projectDetail.informationCid,
    lastCommunityUpdateCid:
      newCommunityUpdateCid ?? projectDetail.lastCommunityUpdateCid,
  };

  const newDedicatedTreasury: DedicatedTreasuryDatum = {
    projectId: dedicatedTreasury.projectId,
    governorAda:
      dedicatedTreasury.governorAda +
      (minTotalFees * protocolParams.governorShareRatio) / RATIO_MULTIPLIER,
    tag: {
      kind: "TagContinuation",
      former: constructTxOutputId(dedicatedTreasuryUtxo),
    },
  };

  let tx = lucid
    .newTx()
    .readFrom([
      protocolParamsUtxo,
      projectUtxo,
      dedicatedTreasuryVScriptUtxo,
      projectDetailVScriptUtxo,
    ])
    .addSigner(deconstructAddress(lucid, project.ownerAddress))
    .collectFrom(
      [projectDetailUtxo],
      S.toCbor(S.toData({ case: "Update" }, ProjectDetailRedeemer))
    )
    .collectFrom(
      [dedicatedTreasuryUtxo],
      S.toCbor(
        S.toData(
          { case: "CollectFees", minFees: minTotalFees, split: false },
          DedicatedTreasuryRedeemer
        )
      )
    )
    .payToContract(
      projectDetailUtxo.address,
      { inline: S.toCbor(S.toData(newProjectDetail, ProjectDetailDatum)) },
      projectDetailUtxo.assets
    )
    .payToContract(
      dedicatedTreasuryUtxo.address,
      {
        inline: S.toCbor(
          S.toData(newDedicatedTreasury, DedicatedTreasuryDatum)
        ),
      },
      { lovelace: BigInt(dedicatedTreasuryUtxo.assets.lovelace) + minTotalFees }
    );

  if (shouldExtendSponsorship) {
    tx = tx.validFrom(txTime);
  }

  return tx;
}
