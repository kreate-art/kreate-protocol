/* eslint-disable jest/no-conditional-in-test */
import { Emulator, Lucid, C } from "lucid-cardano";

import { compileKolourNftScript } from "@/commands/compile-kolour-scripts";
import { exportScript } from "@/contracts/compile";
import { getPaymentKeyHash, signAndSubmit } from "@/helpers/lucid";
import { Kolour, KolourEntry } from "@/schema/teiki/kolours";
import { KOLOUR_TX_MAX_DURATION } from "@/transactions/kolours/constants";
import {
  MintKolourNftTxParams,
  buildBurnKolourNftTx,
  buildMintKolourNftTx,
  verifyKolourNftMintingTx,
} from "@/transactions/kolours/kolour-nft";
import { Hex } from "@/types";

import {
  attachUtxos,
  generateAccount,
  generateCid,
  generateKolour,
  generateOutRef,
  generateReferral,
  generateScriptAddress,
} from "./emulator";

const PRODUCER_ACCOUNT = await generateAccount();
const emulator = new Emulator([PRODUCER_ACCOUNT]);
const lucid = await Lucid.new(emulator);

describe("kolour transactions", () => {
  it("mint kolour nft tx", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(PRODUCER_ACCOUNT.seedPhrase);
    const producerAddress = PRODUCER_ACCOUNT.address;

    const kolourNftScript = exportScript(
      compileKolourNftScript({
        producerPkh: getPaymentKeyHash(producerAddress),
      })
    );

    const kolourNftRefScriptUtxo = {
      ...generateOutRef(),
      address: generateScriptAddress(lucid),
      assets: { lovelace: 2_000_000n },
      scriptRef: kolourNftScript,
    };

    attachUtxos(emulator, [kolourNftRefScriptUtxo]);
    emulator.awaitBlock(20);

    const txTimeStart = emulator.now();
    const txTimeEnd = txTimeStart + 300_000;

    const params: MintKolourNftTxParams = {
      quotation: {
        source: {
          type: "genesis_kreation",
          kreation: "Genesis Kreation #00",
        },
        referral: generateReferral(),
        kolours: generateKolourListings(1),
        userAddress: producerAddress,
        feeAddress: producerAddress,
        expiration: emulator.now() + Number(KOLOUR_TX_MAX_DURATION),
      },
      kolourNftRefScriptUtxo,
      producerPkh: getPaymentKeyHash(producerAddress),
      txTimeStart,
      txTimeEnd,
    };

    const tx = buildMintKolourNftTx(lucid, params) //
      .addSigner(producerAddress);

    const txComplete = await tx.complete();

    const signedTx = await txComplete.sign().complete();

    verifyKolourNftMintingTx(lucid, {
      tx: C.Transaction.from_bytes(Buffer.from(signedTx.toString(), "hex")),
      quotation: params.quotation,
      kolourNftMph: lucid.utils.validatorToScriptHash(kolourNftScript),
    });

    const txHash = await signedTx.submit();
    await expect(lucid.awaitTx(txHash)).resolves.toBe(true);
  });

  it("burn kolour nft tx", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(PRODUCER_ACCOUNT.seedPhrase);
    const producerAddress = PRODUCER_ACCOUNT.address;

    const kolourNftScript = exportScript(
      compileKolourNftScript({
        producerPkh: getPaymentKeyHash(producerAddress),
      })
    );
    const kolourNftMph = lucid.utils.validatorToScriptHash(kolourNftScript);

    const kolours = generateKolours(10);

    const kolourNftRefScriptUtxo = {
      ...generateOutRef(),
      address: generateScriptAddress(lucid),
      assets: { lovelace: 2_000_000n },
      scriptRef: kolourNftScript,
    };

    for (const kolour of kolours) {
      const randomKolourNftUtxo = {
        ...generateOutRef(),
        address: producerAddress, // any address contains kolour NFT
        assets: { lovelace: 2_000_000n, [kolourNftMph + kolour]: 1n },
      };
      attachUtxos(emulator, [randomKolourNftUtxo]);
    }

    attachUtxos(emulator, [kolourNftRefScriptUtxo]);
    emulator.awaitBlock(20);

    const tx = buildBurnKolourNftTx(lucid, {
      kolours,
      kolourNftRefScriptUtxo,
    }) //
      .addSigner(producerAddress);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});

function generateKolourListings(size: number): Record<Kolour, KolourEntry> {
  const kolourListings = new Map();
  for (let i = 0; i < size; i++) {
    kolourListings.set("aabbcc", {
      fee: 2_561_000,
      image: "ipfs://" + generateCid(),
    });
  }
  return Object.fromEntries(kolourListings);
}

function generateKolours(size: number): Hex[] {
  return [...Array(size)].map((_) => generateKolour());
}
