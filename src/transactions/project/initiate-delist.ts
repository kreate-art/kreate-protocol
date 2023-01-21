import { Lucid, UTxO } from "lucid-cardano";

import { getCurrentTime } from "@/helpers/lucid";
import * as S from "@/schema";
import { ProjectDatum, ProjectRedeemer } from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

export type InitiateDelistParams = {
  projectUtxos: UTxO[];
  projectVRefScriptUtxo: UTxO;
  protocolParamsUtxo: UTxO;
  txTimeStartPadding?: TimeDifference;
  txTimeEndPadding?: TimeDifference;
};

export function initiateDelistTx(
  lucid: Lucid,
  {
    projectUtxos,
    projectVRefScriptUtxo,
    protocolParamsUtxo,
    txTimeStartPadding = 60_000,
    txTimeEndPadding = 60_000,
  }: InitiateDelistParams
) {
  assert(
    protocolParamsUtxo.datum != null,
    "Invalid protocol params UTxO: Missing inline datum"
  );

  const protocolParams = S.fromData(
    S.fromCbor(protocolParamsUtxo.datum),
    ProtocolParamsDatum
  );

  const now = getCurrentTime(lucid);
  const txTimeStart = now - txTimeStartPadding;
  const txTimeEnd = now + txTimeEndPadding;

  let tx = lucid
    .newTx()
    .readFrom([projectVRefScriptUtxo, protocolParamsUtxo])
    .collectFrom(
      projectUtxos,
      S.toCbor(S.toData({ case: "InitiateDelist" }, ProjectRedeemer))
    )
    .validFrom(txTimeStart)
    .validTo(txTimeEnd);

  for (const projectUtxo of projectUtxos) {
    assert(
      projectUtxo.datum != null,
      "Invalid project UTxO: Missing inline datum"
    );

    const projectDatum = S.fromData(
      S.fromCbor(projectUtxo.datum),
      ProjectDatum
    );

    const outputProjectDatum: ProjectDatum = {
      ...projectDatum,
      status: {
        type: "PreDelisted",
        pendingUntil: {
          timestamp:
            BigInt(txTimeEnd) +
            protocolParams.projectDelistWaitingPeriod.milliseconds,
        },
      },
    };

    tx = tx.payToContract(
      projectUtxo.address,
      { inline: S.toCbor(S.toData(outputProjectDatum, ProjectDatum)) },
      { ...projectUtxo.assets }
    );
  }
  return tx;
}
