import { Emulator, Lucid, UTxO, Unit } from "lucid-cardano";

import { compileOpenTreasuryVScript } from "@/commands/compile-scripts";
import { SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS } from "@/commands/generate-protocol-params";
import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { exportScript } from "@/contracts/compile";
import { addressFromScriptHashes, signAndSubmit } from "@/helpers/lucid";
import { constructAddress, constructTxOutputId } from "@/helpers/schema";
import * as S from "@/schema";
import { ProtocolParamsDatum } from "@/schema/teiki/protocol";
import { OpenTreasuryDatum } from "@/schema/teiki/treasury";
import { MIN_UTXO_LOVELACE } from "@/transactions/constants";
import {
  Params,
  withdrawAdaTx,
} from "@/transactions/treasury/open-treasury/withdraw-ada";

import {
  attachUtxos,
  generateAccount,
  generateBlake2b224Hash,
  generateOutRef,
  generateScriptAddress,
  generateWalletAddress,
} from "../emulator";
import { generateProtocolRegistry, getRandomLovelaceAmount } from "../utils";

const GOVERNOR_ACCOUNT = await generateAccount();
const ANYONE_ACCOUNT = await generateAccount();
const emulator = new Emulator([GOVERNOR_ACCOUNT, ANYONE_ACCOUNT]);
const lucid = await Lucid.new(emulator);

// context
const protocolNftMph = generateBlake2b224Hash();
const protocolSvHash = generateBlake2b224Hash();
const refScriptAddress = generateScriptAddress(lucid);

const stakingManagerAddress = generateWalletAddress(lucid);
const protocolParamsAddress = generateScriptAddress(lucid);

const openTreasuryVScript = exportScript(
  compileOpenTreasuryVScript({ protocolNftMph })
);

const openTreasuryVScriptHash =
  lucid.utils.validatorToScriptHash(openTreasuryVScript);

const openTreasuryVScriptAddress = addressFromScriptHashes(
  lucid,
  openTreasuryVScriptHash
);

const openTreasuryVRefScriptUtxo: UTxO = {
  ...generateOutRef(),
  address: refScriptAddress,
  assets: { lovelace: MIN_UTXO_LOVELACE },
  scriptRef: openTreasuryVScript,
};

const registry = generateProtocolRegistry(protocolSvHash, {
  openTreasury: openTreasuryVScriptHash,
});

const protocolParamsDatum: ProtocolParamsDatum = {
  registry,
  governorAddress: constructAddress(GOVERNOR_ACCOUNT.address),
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

describe("open treasury transactions", () => {
  it("withdraw ADA tx - protocol-governor", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(GOVERNOR_ACCOUNT.seedPhrase);

    const openTreasuryUtxos = generateOpenTreasuryUtxoList(10);
    attachUtxos(emulator, [
      protocolParamsUtxo,
      openTreasuryVRefScriptUtxo,
      ...openTreasuryUtxos,
    ]);

    emulator.awaitBlock(10);

    const params: Params = {
      protocolParamsUtxo,
      openTreasuryUtxos,
      openTreasuryVRefScriptUtxo,
      actor: "protocol-governor",
    };

    const tx = withdrawAdaTx(lucid, params);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });

  it("withdraw ADA tx - any one", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(GOVERNOR_ACCOUNT.seedPhrase);

    const openTreasuryUtxos = generateOpenTreasuryUtxoList(10);
    attachUtxos(emulator, [
      protocolParamsUtxo,
      openTreasuryVRefScriptUtxo,
      ...openTreasuryUtxos,
    ]);

    emulator.awaitBlock(10);

    const params: Params = {
      protocolParamsUtxo,
      openTreasuryUtxos,
      openTreasuryVRefScriptUtxo,
      actor: "anyone",
    };

    const tx = withdrawAdaTx(lucid, params);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});

function generateOpenTreasuryUtxo() {
  const datum: OpenTreasuryDatum = {
    governorAda: getRandomLovelaceAmount(),
    tag: {
      kind: "TagContinuation",
      former: constructTxOutputId(generateOutRef()),
    },
  };

  return {
    ...generateOutRef(),
    address: openTreasuryVScriptAddress,
    assets: {
      lovelace: datum.governorAda + getRandomLovelaceAmount(),
    },
    datum: S.toCbor(S.toData(datum, OpenTreasuryDatum)),
  };
}

function generateOpenTreasuryUtxoList(size: number): UTxO[] {
  return [...Array(size)].map((_) => generateOpenTreasuryUtxo());
}
