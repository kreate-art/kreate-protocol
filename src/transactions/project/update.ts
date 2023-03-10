import { Lucid, Tx, UTxO } from "lucid-cardano";

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
import { UnixTime } from "@/types";
import { assert } from "@/utils";

import { PROJECT_SPONSORSHIP_RESOLUTION, RATIO_MULTIPLIER } from "../constants";

export type UpdateProjectParams = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  projectDetailUtxo: UTxO;
  dedicatedTreasuryUtxo: UTxO;
  projectDetailVRefScriptUtxo: UTxO;
  dedicatedTreasuryVRefScriptUtxo: UTxO;
  newSponsorshipAmount?: bigint;
  newInformationCid?: IpfsCid;
  newAnnouncementCid?: IpfsCid;
  txTime: UnixTime;
};

type Result = { tx: Tx; sponsorshipFee: bigint };

export function updateProjectTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    dedicatedTreasuryUtxo,
    projectDetailVRefScriptUtxo,
    dedicatedTreasuryVRefScriptUtxo,
    newSponsorshipAmount,
    newInformationCid,
    newAnnouncementCid,
    txTime,
  }: UpdateProjectParams
): Result {
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

  const txTimeStart = txTime;

  let sponsorshipFee = 0n;
  if (newSponsorshipAmount != null) {
    if (projectDetail.sponsorship == null) {
      sponsorshipFee = newSponsorshipAmount;
    } else {
      const o_amount = projectDetail.sponsorship?.amount ?? 0n;
      const o_until = projectDetail.sponsorship?.until.timestamp ?? 0n;
      const now = BigInt(txTimeStart);
      const duration = protocolParams.projectSponsorshipDuration.milliseconds;
      const resolution = PROJECT_SPONSORSHIP_RESOLUTION;
      let leftover = duration;
      if (leftover > o_until - now) leftover = o_until - now;
      if (leftover < 0n) leftover = 0n;
      const discount =
        (o_amount * (leftover / resolution)) / (duration / resolution);
      let fee = newSponsorshipAmount - discount;
      if (fee < 0n) fee = 0n;
      sponsorshipFee = fee;
    }
  }

  let totalFees = sponsorshipFee;
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

  const newProjectDetail: ProjectDetailDatum = {
    ...projectDetail,
    sponsorship:
      newSponsorshipAmount != null
        ? {
            amount: newSponsorshipAmount,
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

  let tx = lucid
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
    .payToContract(
      projectDetailUtxo.address,
      { inline: S.toCbor(S.toData(newProjectDetail, ProjectDetailDatum)) },
      projectDetailUtxo.assets
    )
    .validFrom(txTimeStart);

  if (totalFees > 0) {
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

    tx = tx
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
        dedicatedTreasuryUtxo.address,
        {
          inline: S.toCbor(
            S.toData(newDedicatedTreasury, DedicatedTreasuryDatum)
          ),
        },
        { lovelace: BigInt(dedicatedTreasuryUtxo.assets.lovelace) + totalFees }
      );
  }

  return { tx, sponsorshipFee };
}
