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
  projectDetailVRefScriptUtxo: UTxO;
  dedicatedTreasuryVRefScriptUtxo: UTxO;
  extendSponsorshipAmount: bigint;
  newInformationCid?: IpfsCid;
  newAnnouncementCid?: IpfsCid;
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
    projectDetailVRefScriptUtxo,
    dedicatedTreasuryVRefScriptUtxo,
    extendSponsorshipAmount,
    newInformationCid,
    newAnnouncementCid,
    txTimePadding = 20000,
  }: UpdateProjectParams
) {
  assert(
    projectDetailVRefScriptUtxo.scriptRef != null,
    "Invalid project detail script UTxO: Missing script reference"
  );

  assert(
    dedicatedTreasuryVRefScriptUtxo.scriptRef != null,
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

  let totalFees = extendSponsorshipAmount;

  if (
    newInformationCid?.cid &&
    newInformationCid.cid !== projectDetail.informationCid.cid
  ) {
    totalFees += protocolParams.projectInformationUpdateFee;
  }

  if (
    newAnnouncementCid?.cid &&
    newAnnouncementCid.cid !== projectDetail.lastAnnouncementCid?.cid
  ) {
    totalFees += protocolParams.projectAnnouncementFee;
  }

  const txTimeStart = getTime({ lucid }) - txTimePadding;

  const newProjectDetail: ProjectDetailDatum = {
    ...projectDetail,
    sponsorship:
      extendSponsorshipAmount > 0n
        ? {
            amount: extendSponsorshipAmount,
            until: {
              timestamp:
                BigInt(txTimeStart) +
                protocolParams.projectSponsorshipDuration.milliseconds,
            },
          }
        : projectDetail.sponsorship,
    informationCid: newInformationCid ?? projectDetail.informationCid,
    lastAnnouncementCid:
      newAnnouncementCid ?? projectDetail.lastAnnouncementCid,
  };

  const newDedicatedTreasury: DedicatedTreasuryDatum = {
    projectId: dedicatedTreasury.projectId,
    governorAda:
      dedicatedTreasury.governorAda +
      (totalFees * protocolParams.governorShareRatio) / RATIO_MULTIPLIER,
    tag: {
      kind: "TagContinuation",
      former: constructTxOutputId(dedicatedTreasuryUtxo),
    },
  };

  return lucid
    .newTx()
    .readFrom([
      protocolParamsUtxo,
      projectUtxo,
      dedicatedTreasuryVRefScriptUtxo,
      projectDetailVRefScriptUtxo,
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
          { case: "CollectFees", fees: totalFees, split: false },
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
      { lovelace: BigInt(dedicatedTreasuryUtxo.assets.lovelace) + totalFees }
    )
    .validFrom(txTimeStart);
}
