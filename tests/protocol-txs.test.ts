import { Address, Data, Emulator, Lucid, Unit, UTxO } from "lucid-cardano";

import {
  compileProtocolNftScript,
  compileProtocolParamsVScript,
  compileProtocolProposalVScript,
  compileProtocolScriptVScript,
  compileProtocolSvScript,
} from "@/commands/compile-scripts";
import { SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS } from "@/commands/generate-protocol-params";
import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { exportScript } from "@/contracts/compile";
import {
  addressFromScriptHashes,
  getPaymentKeyHash,
  signAndSubmit,
} from "@/helpers/lucid";
import { constructAddress, constructTxOutputId } from "@/helpers/schema";
import { getTime } from "@/helpers/time";
import * as S from "@/schema";
import {
  ProtocolParamsDatum,
  ProtocolProposalDatum,
} from "@/schema/teiki/protocol";
import { MIN_UTXO_LOVELACE } from "@/transactions/constants";
import {
  applyProtocolProposalTx,
  ApplyProtocolTxParams,
} from "@/transactions/protocol/apply";
import {
  BootstrapProtocolParams,
  bootstrapProtocolTx,
} from "@/transactions/protocol/bootstrap";
import {
  cancelProtocolProposalTx,
  CancelProtocolTxParams,
} from "@/transactions/protocol/cancel";
import {
  proposeProtocolProposalTx,
  ProposeProtocolTxParams,
} from "@/transactions/protocol/propose";
import {
  reclaimProtocolScriptTx,
  Params as ReclaimScriptUtxoParams,
} from "@/transactions/protocol/reclaim-scripts";
import { withdrawProtocolRewardTx } from "@/transactions/protocol/withdraw";

import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
  generateScriptAddress,
  generateWalletAddress,
} from "./emulator";
import { generateProtocolRegistry, getRandomLovelaceAmount } from "./utils";

const BOOTSTRAP_ACCOUNT = await generateAccount();
const emulator = new Emulator([BOOTSTRAP_ACCOUNT]);
const lucid = await Lucid.new(emulator);

describe("protocol transactions", () => {
  it("bootstrap tx", async () => {
    expect.assertions(2);

    lucid.selectWalletFromSeed(BOOTSTRAP_ACCOUNT.seedPhrase);

    const governorAddress = await lucid.wallet.address();
    const stakingManagerAddress = await lucid.wallet.address();

    const poolId = "pool1ve7vhcyde2d342wmqcwcudd906jk749t37y7fmz5e6mvgghrwh3";

    const seedUtxo = (await lucid.wallet.getUtxos())[0];

    expect(seedUtxo).toBeTruthy();

    const protocolNftScript = exportScript(
      compileProtocolNftScript({ protocolSeed: seedUtxo })
    );

    const protocolNftMph = lucid.utils.validatorToScriptHash(protocolNftScript);

    const protocolStakeValidator = exportScript(
      compileProtocolSvScript({ protocolNftMph })
    );

    const protocolSvHash = lucid.utils.validatorToScriptHash(
      protocolStakeValidator
    );

    const protocolStakeCredential =
      lucid.utils.scriptHashToCredential(protocolSvHash);

    const protocolStakeAddress = lucid.utils.credentialToRewardAddress(
      protocolStakeCredential
    );

    const protocolParamsAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
      protocolStakeCredential
    );

    const protocolProposalAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
      protocolStakeCredential
    );

    const registry = generateProtocolRegistry(protocolSvHash);

    const params: BootstrapProtocolParams = {
      protocolParams: SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
      seedUtxo,
      governorAddress,
      stakingManagerAddress,
      poolId,
      registry,
      protocolNftScript,
      protocolParamsAddress,
      protocolProposalAddress,
      protocolStakeAddress,
      protocolStakeValidator,
    };

    emulator.awaitBlock(100);

    const tx = bootstrapProtocolTx(lucid, params);

    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("propose protocol proposal tx", async () => {
    expect.assertions(1);

    const governorAddress = await lucid.wallet.address();
    const stakingManagerAddress = await lucid.wallet.address();

    const protocolNftMph = generateBlake2b224Hash();

    const protocolParamsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;
    const protocolProposalNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL;

    const protocolProposalValidator = exportScript(
      compileProtocolProposalVScript({ protocolNftMph })
    );

    const protocolProposalValidatorHash = lucid.utils.validatorToScriptHash(
      protocolProposalValidator
    );

    const protocolParamsAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );
    const protocolProposalAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(protocolProposalValidatorHash)
    );
    const protocolProposalScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const registry = generateProtocolRegistry(generateBlake2b224Hash());

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
      stakingManager: constructAddress(stakingManagerAddress).paymentCredential,
      ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    };
    const proposedProtocolParamsDatum: ProtocolParamsDatum = {
      ...protocolParamsDatum,
      projectPledge: 2_000_000_000n,
    };

    const protocolParamsUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolParamsAddress,
      assets: { lovelace: 2_000_000n, [protocolParamsNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
    };

    const protocolProposalUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolProposalAddress,
      assets: { lovelace: 2_000_000n, [protocolProposalNftUnit]: 1n },
      datum: Data.void(),
    };
    const protocolProposalRefScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolProposalScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: protocolProposalValidator,
    };

    attachUtxos(emulator, [
      protocolParamsUtxo,
      protocolProposalUtxo,
      protocolProposalRefScriptUtxo,
    ]);

    const params: ProposeProtocolTxParams = {
      protocolParamsUtxo,
      proposedProtocolParamsDatum,
      protocolProposalUtxo,
      protocolProposalRefScriptUtxo,
    };

    const tx = proposeProtocolProposalTx(lucid, params);

    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("cancel protocol proposal tx", async () => {
    expect.assertions(1);

    const governorAddress = await lucid.wallet.address();
    const stakingManagerAddress = await lucid.wallet.address();

    const protocolNftMph = generateBlake2b224Hash();

    const protocolParamsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;
    const protocolProposalNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL;

    const protocolProposalValidator = exportScript(
      compileProtocolProposalVScript({ protocolNftMph })
    );

    const protocolProposalValidatorHash = lucid.utils.validatorToScriptHash(
      protocolProposalValidator
    );

    const protocolParamsAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );
    const protocolProposalAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(protocolProposalValidatorHash)
    );
    const protocolProposalScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const registry = generateProtocolRegistry(generateBlake2b224Hash());

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
      stakingManager: constructAddress(stakingManagerAddress).paymentCredential,
      ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    };

    const protocolParamsUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolParamsAddress,
      assets: { lovelace: 2_000_000n, [protocolParamsNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
    };

    const protocolProposalDatum: ProtocolProposalDatum = {
      proposal: {
        params: { ...protocolParamsDatum, projectPledge: 2_000_000_000n },
        base: constructTxOutputId(protocolParamsUtxo),
        inEffectAt: { timestamp: 0n },
      },
    };

    const protocolProposalUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolProposalAddress,
      assets: { lovelace: 2_000_000n, [protocolProposalNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolProposalDatum, ProtocolProposalDatum)),
    };
    const protocolProposalRefScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolProposalScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: protocolProposalValidator,
    };

    attachUtxos(emulator, [
      protocolParamsUtxo,
      protocolProposalUtxo,
      protocolProposalRefScriptUtxo,
    ]);

    const params: CancelProtocolTxParams = {
      protocolParamsUtxo,
      protocolProposalUtxo,
      protocolProposalRefScriptUtxo,
    };

    const tx = cancelProtocolProposalTx(lucid, params);

    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("apply protocol proposal tx", async () => {
    expect.assertions(1);

    const governorAddress = await lucid.wallet.address();
    const stakingManagerAddress = await lucid.wallet.address();

    const protocolNftMph = generateBlake2b224Hash();

    const protocolParamsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;
    const protocolProposalNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL;

    const protocolParamsValidator = exportScript(
      compileProtocolParamsVScript({ protocolNftMph })
    );
    const protocolProposalValidator = exportScript(
      compileProtocolProposalVScript({ protocolNftMph })
    );

    const protocolParamsValidatorHash = lucid.utils.validatorToScriptHash(
      protocolParamsValidator
    );
    const protocolProposalValidatorHash = lucid.utils.validatorToScriptHash(
      protocolProposalValidator
    );

    const protocolParamsAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(protocolParamsValidatorHash)
    );
    const protocolProposalAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(protocolProposalValidatorHash)
    );
    const protocolScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const registry = generateProtocolRegistry(generateBlake2b224Hash());

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
      stakingManager: constructAddress(stakingManagerAddress).paymentCredential,
      ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    };

    const protocolParamsUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolParamsAddress,
      assets: { lovelace: 2_000_000n, [protocolParamsNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
    };

    const protocolProposalDatum: ProtocolProposalDatum = {
      proposal: {
        params: { ...protocolParamsDatum, projectPledge: 2_000_000_000n },
        base: constructTxOutputId(protocolParamsUtxo),
        inEffectAt: { timestamp: BigInt(getTime({ lucid })) },
      },
    };

    const protocolProposalUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolProposalAddress,
      assets: { lovelace: 2_000_000n, [protocolProposalNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolProposalDatum, ProtocolProposalDatum)),
    };
    const protocolParamsScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: protocolParamsValidator,
    };
    const protocolProposalRefScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: protocolProposalValidator,
    };

    attachUtxos(emulator, [
      protocolParamsUtxo,
      protocolProposalUtxo,
      protocolParamsScriptUtxo,
      protocolProposalRefScriptUtxo,
    ]);

    const params: ApplyProtocolTxParams = {
      protocolParamsUtxo,
      protocolProposalUtxo,
      protocolScriptUtxos: [
        protocolParamsScriptUtxo,
        protocolProposalRefScriptUtxo,
      ],
    };

    emulator.awaitSlot(200);

    const tx = applyProtocolProposalTx(lucid, params);

    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);

    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("withdraw staking rewards tx", async () => {
    expect.assertions(2);

    const poolId = "pool1ve7vhcyde2d342wmqcwcudd906jk749t37y7fmz5e6mvgghrwh3";
    const rewardAmount = 1_000_000_000n;
    lucid.selectWalletFromSeed(BOOTSTRAP_ACCOUNT.seedPhrase);
    const governorAddress = await lucid.wallet.address();
    const stakingManagerAddress = await lucid.wallet.address();

    const protocolNftMph = generateBlake2b224Hash();

    const paramsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

    const protocolStakeValidator = exportScript(
      compileProtocolSvScript({ protocolNftMph })
    );

    const protocolSvHash = lucid.utils.validatorToScriptHash(
      protocolStakeValidator
    );

    const protocolStakeCredential =
      lucid.utils.scriptHashToCredential(protocolSvHash);

    const protocolStakeAddress = lucid.utils.credentialToRewardAddress(
      protocolStakeCredential
    );

    const protocolParamsAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
      protocolStakeCredential
    );

    const protocolScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash()),
      protocolStakeCredential
    );

    const registry = generateProtocolRegistry(protocolSvHash);

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
      stakingManager: constructAddress(stakingManagerAddress).paymentCredential,
      ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    };

    const protocolParamsUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolParamsAddress,
      assets: { lovelace: 2_000_000n, [paramsNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
    };

    const protocolStakeScriptRefUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolScriptAddress,
      assets: { lovelace: 2_000_000n },
      scriptRef: protocolStakeValidator,
    };

    attachUtxos(emulator, [protocolParamsUtxo, protocolStakeScriptRefUtxo]);

    const openTreasuryAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(
        registry.openTreasuryValidator.latest.script.hash
      ),
      protocolStakeCredential
    );

    const delegateTxC = await lucid
      .newTx()
      .addSignerKey(getPaymentKeyHash(governorAddress))
      .readFrom([protocolParamsUtxo, protocolStakeScriptRefUtxo])
      .registerStake(protocolStakeAddress)
      .delegateTo(protocolStakeAddress, poolId, Data.void())
      .complete();

    const delegateTxHash = await signAndSubmit(delegateTxC);
    await expect(lucid.awaitTx(delegateTxHash)).resolves.toBe(true);

    emulator.distributeRewards(rewardAmount);

    const withdrawTx = withdrawProtocolRewardTx(lucid, {
      protocolParamsUtxo,
      protocolStakeScriptRefUtxo,
      rewards: rewardAmount,
      stakeAddress: protocolStakeAddress,
      openTreasuryAddress,
    });

    const withdrawTxC = await withdrawTx.complete();
    const withdrawTxHash = await signAndSubmit(withdrawTxC);

    await expect(lucid.awaitTx(withdrawTxHash)).resolves.toBe(true);
  });

  it("reclaim scripts tx", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BOOTSTRAP_ACCOUNT.seedPhrase);

    const protocolSvHash = generateBlake2b224Hash();
    const protocolNftMph = generateBlake2b224Hash();

    const registry = generateProtocolRegistry(protocolSvHash);
    const governorAddress = await lucid.wallet.address();
    const stakingManagerAddress = generateWalletAddress(lucid);
    const refScriptAddress = generateScriptAddress(lucid);

    const protocolParamsAddress = generateScriptAddress(lucid);

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
      stakingManager: constructAddress(stakingManagerAddress).paymentCredential,
      ...SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    };

    const protocolParamsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

    const protocolParamsUtxo: UTxO = {
      ...generateOutRef(),
      address: protocolParamsAddress,
      assets: { lovelace: MIN_UTXO_LOVELACE, [protocolParamsNftUnit]: 1n },
      datum: S.toCbor(S.toData(protocolParamsDatum, ProtocolParamsDatum)),
    };

    const protocolScriptVScript = exportScript(
      compileProtocolScriptVScript({ protocolNftMph })
    );

    const protocolScriptVScriptHash = lucid.utils.validatorToScriptHash(
      protocolScriptVScript
    );

    const protocolScriptVScriptAddress = addressFromScriptHashes(
      lucid,
      protocolScriptVScriptHash
    );

    const protocolScriptVRefScriptUtxo: UTxO = {
      ...generateOutRef(),
      address: refScriptAddress,
      assets: { lovelace: MIN_UTXO_LOVELACE },
      scriptRef: protocolScriptVScript,
    };

    const protocolScriptUtxos: UTxO[] = generateProtocolScriptUtxoList(
      protocolScriptVScriptAddress,
      30
    );

    attachUtxos(emulator, [
      protocolParamsUtxo,
      protocolScriptVRefScriptUtxo,
      ...protocolScriptUtxos,
    ]);

    emulator.awaitBlock(10);

    const params: ReclaimScriptUtxoParams = {
      protocolParamsUtxo,
      protocolScriptVRefScriptUtxo,
      reclaimUtxos: protocolScriptUtxos,
    };

    const tx = reclaimProtocolScriptTx(lucid, params);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});

function generateProtocolScriptUtxo(scriptAddress: Address) {
  return {
    ...generateOutRef(),
    address: scriptAddress,
    assets: { lovelace: getRandomLovelaceAmount() },
    datum: Data.void(),
  };
}

function generateProtocolScriptUtxoList(
  scriptAddress: Address,
  size: number
): UTxO[] {
  return [...Array(size)].map((_) => generateProtocolScriptUtxo(scriptAddress));
}
