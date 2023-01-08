import { Emulator, Lucid, UTxO, Unit } from "lucid-cardano";

import {
  compileProjectSvScript,
  compileProofOfBackingMpScript,
} from "@/commands/compile-scripts";
import { SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS } from "@/commands/generate-protocol-params";
import {
  PROJECT_AT_TOKEN_NAMES,
  PROTOCOL_NFT_TOKEN_NAMES,
} from "@/contracts/common/constants";
import { exportScript } from "@/contracts/compile";
import { signAndSubmit } from "@/helpers/lucid";
import {
  constructAddress,
  constructProjectIdUsingBlake2b,
} from "@/helpers/schema";
import * as S from "@/schema";
import { ProjectDatum, ProjectScriptDatum } from "@/schema/teiki/project";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { createBackingTx } from "@/transactions/backing/back";

import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
} from "./emulator";
import { generateProtocolRegistry } from "./utils";

const BACKER_ACCOUNT = await generateAccount();
const emulator = new Emulator([BACKER_ACCOUNT]);
const lucid = await Lucid.new(emulator);

describe("backing transactions", () => {
  it("create backing tx", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const refScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const projectsAuthTokenMph = generateBlake2b224Hash();
    const protocolNftMph = generateBlake2b224Hash();
    const teikiMph = generateBlake2b224Hash();
    const projectId = constructProjectIdUsingBlake2b(generateOutRef());
    const protocolStakeValidatorHash = generateBlake2b224Hash();
    const backingValidatorHash = generateBlake2b224Hash();

    const proofOfBackingMintingPolicy = exportScript(
      compileProofOfBackingMpScript(
        projectsAuthTokenMph,
        protocolNftMph,
        teikiMph
      )
    );

    const proofOfBackingPolicyRefUtxo: UTxO = {
      ...generateOutRef(),
      address: refScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: proofOfBackingMintingPolicy,
    };

    const projectStakeValidator = exportScript(
      compileProjectSvScript(
        projectId,
        "",
        projectsAuthTokenMph,
        protocolNftMph
      )
    );

    const projectATUnit: Unit =
      projectsAuthTokenMph + PROJECT_AT_TOKEN_NAMES.PROJECT;
    const projectScriptATUnit: Unit =
      projectsAuthTokenMph + PROJECT_AT_TOKEN_NAMES.PROJECT_SCRIPT;

    const projectAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const ownerAddress = lucid.utils.credentialToAddress(
      lucid.utils.keyHashToCredential(generateBlake2b224Hash())
    );

    const current_project_milestone = 0n;

    const projectDatum: ProjectDatum = {
      projectId: { id: projectId },
      ownerAddress: constructAddress(ownerAddress),
      milestoneReached: current_project_milestone,
      isStakingDelegationManagedByProtocol: true,
      status: { status: "Active" },
    };

    const projectUtxo: UTxO = {
      ...generateOutRef(),
      address: projectAddress,
      assets: { lovelace: 2_000_000n, [projectATUnit]: 1n },
      datum: S.toCbor(S.toData(projectDatum, ProjectDatum)),
    };

    const projectScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const projectScriptDatum: ProjectScriptDatum = {
      projectId: { id: projectId },
      stakingKeyDeposit: 1n,
    };
    const projectScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: projectScriptAddress,
      assets: { lovelace: 2_000_000n, [projectScriptATUnit]: 1n },
      datum: S.toCbor(S.toData(projectScriptDatum, ProjectScriptDatum)),
      scriptRef: projectStakeValidator,
    };

    const registry = generateProtocolRegistry(protocolStakeValidatorHash, {
      backing: backingValidatorHash,
    });

    const governorAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
      ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    };

    const protocolParamsAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const protocolParamsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

    const protocolParamsUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolParamsAddress,
      assets: { lovelace: 2_000_000n, [protocolParamsNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
    };

    attachUtxos(emulator, [
      proofOfBackingPolicyRefUtxo,
      projectUtxo,
      projectScriptUtxo,
      protocolParamsUtxo,
    ]);

    const backingScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(backingValidatorHash),
      lucid.utils.scriptHashToCredential(
        lucid.utils.validatorToScriptHash(projectStakeValidator)
      )
    );

    const createBackingParams = {
      protocolParamsUtxo,
      projectInfo: {
        id: projectId,
        currentMilestone: current_project_milestone,
      },
      backingInfo: {
        amount: 1_000_000_000n,
        backerAddress: BACKER_ACCOUNT.address,
      },
      backingScriptAddress,
      proofOfBackingPolicyRefUtxo,
      projectUtxo,
      projectScriptUtxo,
    };

    const tx = createBackingTx(lucid, createBackingParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});
