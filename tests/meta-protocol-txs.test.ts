import { Emulator, Lucid, Unit, UTxO } from "lucid-cardano";

import {
  compileTeikiPlantNftScript,
  compileTeikiPlantVScript,
} from "@/commands/compile-scripts";
import { TEIKI_PLANT_NFT_TOKEN_NAME } from "@/contracts/common/constants";
import { exportScript } from "@/contracts/compile";
import {
  getCurrentTime,
  getPaymentKeyHash,
  signAndSubmit,
} from "@/helpers/lucid";
import * as S from "@/schema";
import { RulesProposal, TeikiPlantDatum } from "@/schema/teiki/meta-protocol";
import {
  applyMetaProtocolProposalTx,
  ApplyMetaProtocolTxParams,
} from "@/transactions/meta-protocol/apply";
import {
  bootstrapMetaProtocolTx,
  BootstrapMetaProtocolTxParams,
} from "@/transactions/meta-protocol/bootstrap";
import {
  cancelMetaProtocolProposalTx,
  CancelMetaProtocolTxParams,
} from "@/transactions/meta-protocol/cancel";
import {
  proposeMetaProtocolProposalTx,
  ProposeMetaProtocolTxParams,
} from "@/transactions/meta-protocol/propose";

import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
} from "./emulator";

const BOOTSTRAP_ACCOUNT = await generateAccount();
const emulator = new Emulator([BOOTSTRAP_ACCOUNT]);
const lucid = await Lucid.new(emulator);

describe("meta-protocol transactions", () => {
  it("bootstrap tx", async () => {
    expect.assertions(2);

    lucid.selectWalletFromSeed(BOOTSTRAP_ACCOUNT.seedPhrase);

    const seedUtxo = (await lucid.wallet.getUtxos())[0];
    expect(seedUtxo).toBeTruthy();

    const governorAddress = await lucid.wallet.address();

    const teikiPlantAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const teikiPlantNftPolicy = exportScript(
      compileTeikiPlantNftScript(seedUtxo)
    );

    const teikiPlantDatum: TeikiPlantDatum = {
      rules: {
        teikiMintingRules: [],
        proposalAuthorizations: [
          {
            authorization: "MustBe",
            credential: {
              type: "PubKey",
              key: { hash: getPaymentKeyHash(governorAddress) },
            },
          },
        ],
        proposalWaitingPeriod: { milliseconds: 20_000n },
      },
      proposal: null,
    };

    const params: BootstrapMetaProtocolTxParams = {
      seedUtxo,
      teikiPlantDatum,
      teikiPlantNftPolicy,
      teikiPlantAddress,
    };

    const tx = bootstrapMetaProtocolTx(lucid, params);

    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("propose meta-protocol proposal tx - mustbe authorization", async () => {
    expect.assertions(1);

    const governorAddress = await lucid.wallet.address();

    const teikiPlantSeed = generateOutRef();

    const teikiPlantNftScript = exportScript(
      compileTeikiPlantNftScript(teikiPlantSeed)
    );
    const teikiPlantNftMph = lucid.utils.mintingPolicyToId(teikiPlantNftScript);
    const teikiPlantValidator = exportScript(
      compileTeikiPlantVScript({ teikiPlantNftMph })
    );

    const teikiPlantValidatorHash =
      lucid.utils.validatorToScriptHash(teikiPlantValidator);

    const teikiPlantAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(teikiPlantValidatorHash)
    );
    const protocolScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const teikiPlantNftUnit: Unit =
      teikiPlantNftMph + TEIKI_PLANT_NFT_TOKEN_NAME;

    const teikiPlantDatum: TeikiPlantDatum = {
      rules: {
        teikiMintingRules: [],
        proposalAuthorizations: [
          {
            authorization: "MustBe",
            credential: {
              type: "PubKey",
              key: { hash: getPaymentKeyHash(governorAddress) },
            },
          },
        ],
        proposalWaitingPeriod: { milliseconds: 20_000n },
      },
      proposal: null,
    };

    const proposedRules: RulesProposal = {
      inEffectAt: { timestamp: BigInt(getCurrentTime(lucid) + 50_000) },
      rules: {
        ...teikiPlantDatum.rules,
        proposalWaitingPeriod: { milliseconds: 10_000n },
      },
    };

    const teikiPlantUtxo: UTxO = {
      ...generateOutRef(),
      address: teikiPlantAddress,
      assets: { lovelace: 2_000_000n, [teikiPlantNftUnit]: 1n },
      datum: S.toCbor(S.toData(teikiPlantDatum, TeikiPlantDatum)),
    };

    const teikiPlantScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: teikiPlantValidator,
    };

    attachUtxos(emulator, [teikiPlantUtxo, teikiPlantScriptUtxo]);

    const params: ProposeMetaProtocolTxParams = {
      teikiPlantUtxo,
      teikiPlantScriptUtxo,
      proposedRules,
    };

    const tx = proposeMetaProtocolProposalTx(lucid, params).addSigner(
      governorAddress
    );

    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it.todo("propose meta-protocol proposal tx - musthave authorization");

  it.todo("propose meta-protocol proposal tx - mustmint authorization");

  it("cancel meta-protocol proposal tx", async () => {
    expect.assertions(1);

    const governorAddress = await lucid.wallet.address();

    const teikiPlantSeed = generateOutRef();

    const teikiPlantNftScript = exportScript(
      compileTeikiPlantNftScript(teikiPlantSeed)
    );
    const teikiPlantNftMph = lucid.utils.mintingPolicyToId(teikiPlantNftScript);
    const teikiPlantValidator = exportScript(
      compileTeikiPlantVScript({ teikiPlantNftMph })
    );

    const teikiPlantValidatorHash =
      lucid.utils.validatorToScriptHash(teikiPlantValidator);

    const teikiPlantAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(teikiPlantValidatorHash)
    );
    const protocolScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const teikiPlantNftUnit: Unit =
      teikiPlantNftMph + TEIKI_PLANT_NFT_TOKEN_NAME;

    const teikiPlantDatum: TeikiPlantDatum = {
      rules: {
        teikiMintingRules: [],
        proposalAuthorizations: [
          {
            authorization: "MustBe",
            credential: {
              type: "PubKey",
              key: { hash: getPaymentKeyHash(governorAddress) },
            },
          },
        ],
        proposalWaitingPeriod: { milliseconds: 20_000n },
      },
      proposal: null,
    };

    const proposedTeikiPlantDatum: TeikiPlantDatum = {
      ...teikiPlantDatum,
      proposal: {
        inEffectAt: { timestamp: BigInt(getCurrentTime(lucid) + 50_000) },
        rules: {
          ...teikiPlantDatum.rules,
          proposalWaitingPeriod: { milliseconds: 10_000n },
        },
      },
    };

    const teikiPlantUtxo: UTxO = {
      ...generateOutRef(),
      address: teikiPlantAddress,
      assets: { lovelace: 2_000_000n, [teikiPlantNftUnit]: 1n },
      datum: S.toCbor(S.toData(proposedTeikiPlantDatum, TeikiPlantDatum)),
    };

    const teikiPlantScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: teikiPlantValidator,
    };

    attachUtxos(emulator, [teikiPlantUtxo, teikiPlantScriptUtxo]);

    const params: CancelMetaProtocolTxParams = {
      teikiPlantUtxo,
      teikiPlantScriptUtxo,
    };

    const tx = cancelMetaProtocolProposalTx(lucid, params).addSigner(
      governorAddress
    );

    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("apply meta-protocol proposal tx", async () => {
    expect.assertions(1);

    const governorAddress = await lucid.wallet.address();

    const teikiPlantSeed = generateOutRef();

    const teikiPlantNftScript = exportScript(
      compileTeikiPlantNftScript(teikiPlantSeed)
    );
    const teikiPlantNftMph = lucid.utils.mintingPolicyToId(teikiPlantNftScript);
    const teikiPlantValidator = exportScript(
      compileTeikiPlantVScript({ teikiPlantNftMph })
    );

    const teikiPlantValidatorHash =
      lucid.utils.validatorToScriptHash(teikiPlantValidator);

    const teikiPlantAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(teikiPlantValidatorHash)
    );
    const protocolScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const teikiPlantNftUnit: Unit =
      teikiPlantNftMph + TEIKI_PLANT_NFT_TOKEN_NAME;

    const teikiPlantDatum: TeikiPlantDatum = {
      rules: {
        teikiMintingRules: [],
        proposalAuthorizations: [
          {
            authorization: "MustBe",
            credential: {
              type: "PubKey",
              key: { hash: getPaymentKeyHash(governorAddress) },
            },
          },
        ],
        proposalWaitingPeriod: { milliseconds: 20_000n },
      },
      proposal: null,
    };

    const proposedTeikiPlantDatum: TeikiPlantDatum = {
      ...teikiPlantDatum,
      proposal: {
        inEffectAt: { timestamp: BigInt(getCurrentTime(lucid) + 50_000) },
        rules: {
          ...teikiPlantDatum.rules,
          proposalWaitingPeriod: { milliseconds: 10_000n },
        },
      },
    };

    const teikiPlantUtxo: UTxO = {
      ...generateOutRef(),
      address: teikiPlantAddress,
      assets: { lovelace: 2_000_000n, [teikiPlantNftUnit]: 1n },
      datum: S.toCbor(S.toData(proposedTeikiPlantDatum, TeikiPlantDatum)),
    };

    const teikiPlantScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: teikiPlantValidator,
    };

    attachUtxos(emulator, [teikiPlantUtxo, teikiPlantScriptUtxo]);

    const params: ApplyMetaProtocolTxParams = {
      teikiPlantUtxo,
      teikiPlantScriptUtxo,
    };

    emulator.awaitSlot(100);

    const tx = applyMetaProtocolProposalTx(lucid, params).addSigner(
      governorAddress
    );

    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });
});
