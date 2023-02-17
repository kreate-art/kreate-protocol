import { Lucid, UTxO } from "lucid-cardano";

import { getTime } from "@/helpers/time";
import * as S from "@/schema";
import { ProjectDatum, ProjectRedeemer } from "@/schema/teiki/project";
import { TimeDifference, UnixTime } from "@/types";
import { assert } from "@/utils";

export type Params = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  projectVRefScriptUtxo: UTxO;
  scheduledClosingTime: UnixTime;
  txTimePadding?: TimeDifference;
};

export function initiateCloseTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    projectVRefScriptUtxo,
    scheduledClosingTime,
    txTimePadding = 60_000,
  }: Params
) {
  assert(
    projectVRefScriptUtxo.scriptRef != null,
    "Invalid project script UTxO: Missing reference script"
  );

  assert(
    projectUtxo.datum != null,
    "Invalid project UTxO: Missing inline datum"
  );
  const project = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  const txTimeEnd = getTime({ lucid }) + txTimePadding;

  return lucid
    .newTx()
    .readFrom([protocolParamsUtxo, projectVRefScriptUtxo])
    .collectFrom(
      [projectUtxo],
      S.toCbor(S.toData({ case: "InitiateClose" }, ProjectRedeemer))
    )
    .payToContract(
      projectUtxo.address,
      {
        inline: S.toCbor(
          S.toData(
            {
              ...project,
              status: {
                type: "PreClosed",
                pendingUntil: { timestamp: BigInt(scheduledClosingTime) },
              },
            },
            ProjectDatum
          )
        ),
      },
      projectUtxo.assets
    )
    .validTo(txTimeEnd);
}
