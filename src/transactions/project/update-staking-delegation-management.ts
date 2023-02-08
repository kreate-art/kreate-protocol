import { Lucid, UTxO } from "lucid-cardano";

import * as S from "@/schema";
import { ProjectDatum, ProjectRedeemer } from "@/schema/teiki/project";
import { assert } from "@/utils";

export type Params = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  projectVRefScriptUtxo: UTxO;
};

export function updateStakingDelegationManagement(
  lucid: Lucid,
  { protocolParamsUtxo, projectUtxo, projectVRefScriptUtxo }: Params
) {
  assert(
    projectUtxo.datum != null,
    "Invalid project UTxO: Missing inline datum"
  );
  const projectDatum = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  const projectRedeemer: ProjectRedeemer = {
    case: "UpdateStakingDelegationManagement",
  };

  const outputProjectDatum: ProjectDatum = {
    ...projectDatum,
    isStakingDelegationManagedByProtocol: false,
  };

  return lucid
    .newTx()
    .readFrom([protocolParamsUtxo, projectVRefScriptUtxo])
    .collectFrom(
      [projectUtxo],
      S.toCbor(S.toData(projectRedeemer, ProjectRedeemer))
    )
    .payToContract(
      projectUtxo.address,
      {
        inline: S.toCbor(S.toData(outputProjectDatum, ProjectDatum)),
      },
      { ...projectUtxo.assets }
    );
}
