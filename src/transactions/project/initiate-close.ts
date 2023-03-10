import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import { ProjectDatum, ProjectRedeemer } from "@/schema/teiki/project";
import { TimeDifference } from "@/types";
import { assert } from "@/utils";

export type Params = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  projectVRefScriptUtxo: UTxO;
  txValidUntil: TimeDifference;
};

export function initiateCloseTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    projectVRefScriptUtxo,
    txValidUntil,
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
                pendingUntil: { timestamp: BigInt(txValidUntil) },
              },
            },
            ProjectDatum
          )
        ),
      },
      projectUtxo.assets
    )
    .validTo(txValidUntil);
}
