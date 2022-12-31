import { Address, Data, Emulator, Lucid, Unit, UTxO } from "lucid-cardano";

import {
  compileProtocolNftScript,
  compileProtocolSvScript,
} from "@/commands/compile-scripts";
import { SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS } from "@/commands/gen-protocol-params";
import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { exportScript } from "@/contracts/compile";
import * as S from "@/schema";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { constructAddress } from "@/transactions/helpers/constructors";
import { getPaymentKeyHash, signAndSubmit } from "@/transactions/helpers/lucid";
import {
  BootstrapProtocolParams,
  bootstrapProtocolTx,
} from "@/transactions/protocol/bootstrap";
import { withdrawProtocolRewardTx } from "@/transactions/protocol/withdraw";

import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
} from "./emulator";
import { generateProtocolRegistry } from "./utils";

const BOOTSTRAP_ACCOUNT = await generateAccount();
const emulator = new Emulator([BOOTSTRAP_ACCOUNT]);
const lucid = await Lucid.new(emulator);

describe("Protocol transactions", () => {
  test("Bootstrap tx", async () => {
    expect.assertions(2);

    lucid.selectWalletFromSeed(BOOTSTRAP_ACCOUNT.seedPhrase);

    const governorAddress: Address = await lucid.wallet.address();

    const poolId = "pool1ve7vhcyde2d342wmqcwcudd906jk749t37y7fmz5e6mvgghrwh3";

    const seedUtxo = (await lucid.wallet.getUtxos())[0];

    expect(seedUtxo).toBeTruthy();

    const protocolNftScript = exportScript(compileProtocolNftScript(seedUtxo));

    const protocolNftMph = lucid.utils.validatorToScriptHash(protocolNftScript);

    const protocolStakeValidator = exportScript(
      compileProtocolSvScript(protocolNftMph)
    );

    const protocolStakeValidatorHash = lucid.utils.validatorToScriptHash(
      protocolStakeValidator
    );

    const protocolStakeCredential = lucid.utils.scriptHashToCredential(
      protocolStakeValidatorHash
    );

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

    const registry = generateProtocolRegistry(protocolStakeValidatorHash);

    const params: BootstrapProtocolParams = {
      protocolParams: SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
      seedUtxo,
      governorAddress,
      poolId,
      registry,
      protocolNftScript,
      protocolParamsAddress,
      protocolProposalAddress,
      protocolStakeAddress,
      protocolStakeValidator,
    };

    const tx = bootstrapProtocolTx(lucid, params);

    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);

    expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  test("Withdraw staking rewards tx", async () => {
    expect.assertions(2);

    const poolId = "pool1ve7vhcyde2d342wmqcwcudd906jk749t37y7fmz5e6mvgghrwh3";
    const rewardAmount = 1_000_000_000n;
    lucid.selectWalletFromSeed(BOOTSTRAP_ACCOUNT.seedPhrase);
    const governorAddress: Address = await lucid.wallet.address();

    const protocolNftMph = generateBlake2b224Hash();

    const paramsNftUnit: Unit =
      protocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PARAMS;

    const protocolStakeValidator = exportScript(
      compileProtocolSvScript(protocolNftMph)
    );

    const protocolStakeValidatorHash = lucid.utils.validatorToScriptHash(
      protocolStakeValidator
    );

    const protocolStakeCredential = lucid.utils.scriptHashToCredential(
      protocolStakeValidatorHash
    );

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

    const registry = generateProtocolRegistry(protocolStakeValidatorHash);

    const protocolParamsDatum: ProtocolParamsDatum = {
      registry,
      governorAddress: constructAddress(governorAddress),
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

    const delegateTx = await lucid
      .newTx()
      .addSignerKey(getPaymentKeyHash(governorAddress))
      .readFrom([protocolParamsUtxo, protocolStakeScriptRefUtxo])
      .registerStake(protocolStakeAddress)
      .delegateTo(protocolStakeAddress, poolId, Data.void())
      .complete();

    expect(lucid.awaitTx(await signAndSubmit(delegateTx))).resolves.toBe(true);

    emulator.distributeRewards(rewardAmount);

    const withdrawTx = withdrawProtocolRewardTx(lucid, {
      protocolParamsUtxo,
      protocolStakeScriptRefUtxo,
      rewards: rewardAmount,
      stakeAddress: protocolStakeAddress,
      openTreasuryAddress,
    });

    const withdrawTxComplete = await withdrawTx.complete();

    expect(
      lucid.awaitTx(await signAndSubmit(withdrawTxComplete))
    ).resolves.toBe(true);
  });
});
