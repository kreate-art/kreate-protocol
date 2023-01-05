import { Address, Emulator, Lucid, UTxO, Unit } from "lucid-cardano";

import {
  compileProjectSvScript,
  compileProjectsAtScript,
} from "@/commands/compile-scripts";
import { SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS } from "@/commands/generate-protocol-params";
import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { exportScript } from "@/contracts/compile";
import * as S from "@/schema";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import {
  constructAddress,
  constructProjectIdUsingBlake2b,
} from "@/transactions/helpers/constructors";
import { signAndSubmit } from "@/transactions/helpers/lucid";
import { createProjectTx } from "@/transactions/project/create";

import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
  generateWalletAddress,
} from "./emulator";
import { generateProtocolRegistry } from "./utils";

const PROJECT_OWNER_ACCOUNT = await generateAccount();
const emulator = new Emulator([PROJECT_OWNER_ACCOUNT]);
const lucid = await Lucid.new(emulator);

describe("project transactions", () => {
  it("create project tx", async () => {
    expect.assertions(2);

    lucid.selectWalletFromSeed(PROJECT_OWNER_ACCOUNT.seedPhrase);

    const seedUtxo = (await lucid.wallet.getUtxos())[0];

    expect(seedUtxo).toBeTruthy();

    const protocolStakeValidatorHash = generateBlake2b224Hash();

    const protocolParamsAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
      lucid.utils.scriptHashToCredential(protocolStakeValidatorHash)
    );

    const registry = generateProtocolRegistry(protocolStakeValidatorHash);

    const governorAddress = await generateWalletAddress();

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
      ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    };

    const protocolNftMph = generateBlake2b224Hash();

    const paramsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

    const protocolParamsUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolParamsAddress,
      assets: { lovelace: 2_000_000n, [paramsNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
    };

    const projectAtMintingPolicy = exportScript(
      compileProjectsAtScript(protocolNftMph)
    );

    const projectsAuthTokenMph = lucid.utils.validatorToScriptHash(
      projectAtMintingPolicy
    );

    const projectStakeValidator = exportScript(
      compileProjectSvScript(
        constructProjectIdUsingBlake2b(seedUtxo),
        "",
        projectsAuthTokenMph,
        protocolNftMph
      )
    );

    const projectScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
      lucid.utils.scriptHashToCredential(
        lucid.utils.validatorToScriptHash(projectStakeValidator)
      )
    );

    const projectAtScriptRefUtxo: UTxO = {
      ...generateOutRef(),
      address: projectScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: projectAtMintingPolicy,
    };

    attachUtxos(emulator, [protocolParamsUtxo, projectAtScriptRefUtxo]);

    const ownerAddress: Address = await lucid.wallet.address();

    // NOTE: When building transactions have start_time before the current time,
    // it is necessary to wait a number of slot
    emulator.awaitSlot(100);

    const createProjectParams = {
      informationCid: { cid: "" },
      isSponsored: true,
      ownerAddress,
      projectAtScriptRefUtxo,
      projectATPolicyId: projectsAuthTokenMph,
      projectStakeValidator,
      protocolParamsUtxo,
      seedUtxo,
    };
    const tx = createProjectTx(lucid, createProjectParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});
