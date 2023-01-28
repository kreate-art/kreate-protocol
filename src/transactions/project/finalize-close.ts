import { Data, Lucid, PolicyId, Unit, UTxO } from "lucid-cardano";

import { PROJECT_AT_TOKEN_NAMES } from "@/contracts/common/constants";
import { deconstructAddress } from "@/helpers/schema";
import * as S from "@/schema";
import {
  ProjectDatum,
  ProjectDetailRedeemer,
  ProjectMintingRedeemer,
  ProjectRedeemer,
  ProjectScriptRedeemer,
} from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { assert } from "@/utils";

import { INACTIVE_PROJECT_UTXO_ADA } from "../constants";

export type FinalizeCloseParams = {
  protocolParamsUtxo: UTxO;
  projectUtxo: UTxO;
  projectDetailUtxo: UTxO;
  projectVScriptUtxo: UTxO;
  projectDetailVScriptUtxo: UTxO;
  projectScriptVScriptUtxo: UTxO;
  projectScriptUtxos: UTxO[];
  projectAtPolicyId: PolicyId;
  projectAtScriptUtxo: UTxO;
};

export function finalizeCloseTx(
  lucid: Lucid,
  {
    protocolParamsUtxo,
    projectUtxo,
    projectDetailUtxo,
    projectVScriptUtxo,
    projectDetailVScriptUtxo,
    projectScriptVScriptUtxo,
    projectScriptUtxos,
    projectAtPolicyId,
    projectAtScriptUtxo,
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
    projectAtScriptUtxo.scriptRef != null,
    "Invalid project at script UTxO: Missing script reference"
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

  const projectAtUnit: Unit =
    projectAtPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

  let tx = lucid
    .newTx()
    .readFrom([
      protocolParamsUtxo,
      projectVScriptUtxo,
      projectDetailVScriptUtxo,
      projectScriptVScriptUtxo,
      projectAtScriptUtxo,
    ])
    .collectFrom(
      projectScriptUtxos,
      S.toCbor(S.toData({ case: "Close" }, ProjectScriptRedeemer))
    )
    .mintAssets(
      { [projectAtUnit]: -BigInt(projectScriptUtxos.length) },
      S.toCbor(S.toData({ case: "DeallocateStaking" }, ProjectMintingRedeemer))
    )
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
      { ...projectUtxo.assets, lovelace: INACTIVE_PROJECT_UTXO_ADA }
    )
    .payToContract(
      outputProjectDetailAddress,
      { inline: projectDetailUtxo.datum },
      projectDetailUtxo.assets
    )
    .addSigner(deconstructAddress(lucid, project.ownerAddress));

  for (const projectScriptUtxo of projectScriptUtxos) {
    assert(
      projectScriptUtxo.scriptRef != null,
      "Invalid project script UTxO: Missing script reference"
    );
    const projectStakeCredential = lucid.utils.scriptHashToCredential(
      lucid.utils.validatorToScriptHash(projectScriptUtxo.scriptRef)
    );
    const projectStakeAddress = lucid.utils.credentialToRewardAddress(
      projectStakeCredential
    );

    tx = tx.deregisterStake(projectStakeAddress, Data.void());
  }

  return tx;
}
