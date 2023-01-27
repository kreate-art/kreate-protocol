import { Lucid, UTxO } from "lucid-cardano";

import { deconstructAddress } from "@/helpers/schema";
import * as S from "@/schema";
import {
  ProjectDatum,
  ProjectDetailRedeemer,
  ProjectRedeemer,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { assert } from "@/utils";

import {
  INACTIVE_PROJECT_UTXO_ADA,
  PROJECT_CLOSE_DISCOUNT_CENTS,
} from "../constants";

export type FinalizeCloseParams = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  projectDetailUtxo: UTxO;
  projectVScriptUtxo: UTxO;
  projectDetailVScriptUtxo: UTxO;
  actor: "project-owner" | "anyone";
};

export function finalizeCloseTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    projectVScriptUtxo,
    projectDetailVScriptUtxo,
    actor,
  }: FinalizeCloseParams
) {
  assert(
    projectVScriptUtxo.scriptRef != null,
    "Invalid project script UTxO: Missing script reference"
  );

  assert(
    projectDetailVScriptUtxo.scriptRef != null,
    "Invalid project detail script UTxO: Missing script reference"
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

  const protocolSvCredential = lucid.utils.scriptHashToCredential(
    protocolParams.registry.protocolStakingValidator.script.hash
  );

  const projectVCredentail = lucid.utils.getAddressDetails(
    projectUtxo.address
  ).paymentCredential;
  assert(
    projectVCredentail,
    "Cannot extract payment credential from the project address"
  );
  const outputProjectAddress = lucid.utils.credentialToAddress(
    projectVCredentail,
    protocolSvCredential
  );

  const projectDetailVCredentail = lucid.utils.getAddressDetails(
    projectDetailUtxo.address
  ).paymentCredential;
  assert(
    projectDetailVCredentail,
    "Cannot extract payment credential from the project address"
  );
  const outputProjectDetailAddress = lucid.utils.credentialToAddress(
    projectDetailVCredentail,
    protocolSvCredential
  );

  let tx = lucid
    .newTx()
    .readFrom([
      protocolParamsUtxo,
      projectVScriptUtxo,
      projectDetailVScriptUtxo,
    ])
    .collectFrom(
      [projectUtxo],
      S.toCbor(S.toData({ case: "FinalizeClose" }, ProjectRedeemer))
    )
    .collectFrom(
      [projectDetailUtxo],
      S.toCbor(S.toData({ case: "Close" }, ProjectDetailRedeemer))
    )
    .payToContract(
      outputProjectAddress,
      {
        inline: S.toCbor(
          S.toData({ ...project, status: { type: "Closed" } }, ProjectDatum)
        ),
      },
      { lovelace: INACTIVE_PROJECT_UTXO_ADA }
    )
    .payToContract(
      outputProjectDetailAddress,
      { inline: projectDetailUtxo.datum },
      projectDetailUtxo.assets
    );

  if (actor === "project-owner") {
    tx = tx.addSigner(deconstructAddress(lucid, project.ownerAddress));
  } else {
    const adaToOwner =
      projectUtxo.assets.lovelace -
      INACTIVE_PROJECT_UTXO_ADA -
      protocolParams.discountCentPrice * PROJECT_CLOSE_DISCOUNT_CENTS;
    if (adaToOwner > 0) {
      tx.payToContract(
        deconstructAddress(lucid, project.ownerAddress),
        {
          inline: S.toCbor(
            S.toData({ ...project, status: { type: "Closed" } }, ProjectDatum)
          ),
        },
        { lovelace: adaToOwner }
      );
    }
  }

  return tx;
}
