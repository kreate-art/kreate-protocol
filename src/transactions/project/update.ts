import { Data, Lucid, Redeemer, UTxO } from "lucid-cardano";

import { IpfsCid } from "@/schema/teiki/common";
import { ProjectDatum, ProjectDetailDatum } from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { DedicatedTreasuryDatum } from "@/schema/teiki/treasury";
import { TimeDifference } from "@/types";

import { getCurrentTime } from "../helpers/time";

export type UpdateProjectParams = {
  protocolParamsDatum: ProtocolParamsDatum;
  protocolParamsUtxo: UTxO;
  projectDatum: ProjectDatum;
  projectDetailDatum: ProjectDetailDatum;
  projectDetailUtxo: UTxO;
  extendsSponsorship: boolean;
  newInformationCid?: IpfsCid;
  newCommunityUpdateCid?: IpfsCid;
  dedicatedTreasuryDatum: DedicatedTreasuryDatum;
  dedicatedTreasuryUtxo: UTxO;
  txTimePadding?: TimeDifference;
};

// TODO: @sk-umiuma: Add the commented params
export function updateProjectTx(
  lucid: Lucid,
  {
    protocolParamsDatum,
    protocolParamsUtxo,
    // projectDatum,
    // projectDetailDatum,
    projectDetailUtxo,
    extendsSponsorship,
    newInformationCid,
    newCommunityUpdateCid,
    // dedicatedTreasuryDatum,
    dedicatedTreasuryUtxo,
    txTimePadding = 20000,
  }: UpdateProjectParams
) {
  const projectOwnerPkh = ""; // FIXME:

  // TODO: @sk-umiuma: Implement this
  const projectDetailRedeemer: Redeemer = Data.void();
  // TODO: @sk-umiuma: Implement this
  const dedicatedTreasuryRedeemer: Redeemer = Data.void();

  let minTotalFees = 0n;

  if (extendsSponsorship) {
    minTotalFees += protocolParamsDatum.projectSponsorshipFee;
  }

  if (newInformationCid) {
    minTotalFees += protocolParamsDatum.projectInformationUpdateFee;
  }

  if (newCommunityUpdateCid) {
    minTotalFees += protocolParamsDatum.projectCommunityUpdateFee;
  }

  let tx = lucid
    .newTx()
    .readFrom([protocolParamsUtxo])
    .addSignerKey(projectOwnerPkh)
    .collectFrom([projectDetailUtxo], projectDetailRedeemer)
    .collectFrom([dedicatedTreasuryUtxo], dedicatedTreasuryRedeemer)
    .payToContract(
      projectDetailUtxo.address,
      { inline: Data.void() }, // FIXME:
      projectDetailUtxo.assets
    )
    .payToContract(
      dedicatedTreasuryUtxo.address,
      { inline: Data.void() }, // FIXME:
      { lovelace: dedicatedTreasuryUtxo.assets.lovelace + minTotalFees }
    );

  if (extendsSponsorship) {
    tx = tx.validTo(getCurrentTime(lucid) + txTimePadding);
  }

  return tx;
}
