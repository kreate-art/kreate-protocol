import { Emulator, Lucid } from "lucid-cardano";

import { createBackingTx } from "@/transactions/backing/create";
import { signAndSubmit } from "@/transactions/helpers/lucid";

import {
  generateAccount,
  generateBlake2b224Hash,
  generateBlake2b256Hash,
} from "./emulator";

const BACKER_ACCOUNT = await generateAccount();
const emulator = new Emulator([BACKER_ACCOUNT]);
const lucid = await Lucid.new(emulator);

describe("backing transactions", () => {
  it("create backing tx", async () => {
    expect.assertions(1);

    lucid.selectWalletFromSeed(BACKER_ACCOUNT.seedPhrase);

    const backingScriptAddress = lucid.utils.credentialToAddress(
      lucid.utils.scriptHashToCredential(generateBlake2b224Hash())
    );

    const createBackingParams = {
      projectInfo: {
        id: generateBlake2b256Hash(),
        currentMilestone: 1n,
      },
      backingInfo: {
        amount: 1_000_000_000n,
        backerAddress: BACKER_ACCOUNT.address,
      },
      backingScriptAddress,
    };

    const tx = createBackingTx(lucid, createBackingParams);

    const txComplete = await tx.complete();

    await expect(lucid.awaitTx(await signAndSubmit(txComplete))).resolves.toBe(
      true
    );
  });
});
