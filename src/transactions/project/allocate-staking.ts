import { Data, Lucid, PolicyId, Script, Unit, UTxO } from "lucid-cardano";

import { PROJECT_AT_TOKEN_NAMES } from "@/contracts/constants";
import { ProjectDatum } from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";

type Actor = "protocol-governor" | "project-owner";

type AllocateStakingParams = {
  protocolParamsDatum: ProtocolParamsDatum;
  protocolParamsUtxo: UTxO;
  projectDatum: ProjectDatum;
  projectUtxo: UTxO;
  stakingValidatorSeed: string;
  actor: Actor;
  projectATPolicyId: PolicyId;
  projectStakeValidator: Script;
};

// TODO: @sk-umiuma: Add the commented params
export function allocateStakingTx(
  lucid: Lucid,
  {
    protocolParamsDatum,
    protocolParamsUtxo,
    projectUtxo,
    // stakingValidatorSeed,
    actor,
    projectATPolicyId,
    projectStakeValidator,
  }: AllocateStakingParams
) {
  // TODO: Move this somewhere else?
  const PROJECT_SCRIPT_UTXO_ADA = 2_000_000n;
  if (!projectUtxo.datum) {
    throw new Error("Project UTxO does not contain datum");
  }

  if (actor !== "protocol-governor" && actor !== "project-owner") {
    throw new Error("Invalid actor");
  }

  const projectATUnit: Unit =
    projectATPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT;
  const projectScriptATUnit: Unit =
    projectATPolicyId + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

  const actorPkh = ""; // FIXME:

  // TODO: sk-umiuma: Implement this
  const projectRedeemer = Data.empty();
  // TODO: sk-umiuma: Implement this
  const projectScriptATRedeemer = Data.empty();

  return lucid
    .newTx()
    .collectFrom([projectUtxo], projectRedeemer)
    .readFrom([protocolParamsUtxo])
    .mintAssets({ [projectScriptATUnit]: 1n }, projectScriptATRedeemer)
    .payToContract(
      projectUtxo.address,
      {
        scriptRef: projectStakeValidator,
        inline: Data.empty(), // FIXME:
      },
      {
        [projectScriptATUnit]: 1n,
        lovelace: PROJECT_SCRIPT_UTXO_ADA,
      }
    )
    .payToContract(projectUtxo.address, projectUtxo.datum, {
      [projectATUnit]: 1n,
      lovelace:
        projectUtxo.assets.lovelace -
        protocolParamsDatum.stakeKeyDeposit -
        PROJECT_SCRIPT_UTXO_ADA,
    })
    .attachCertificateValidator(projectStakeValidator)
    .addSignerKey(actorPkh);
}
