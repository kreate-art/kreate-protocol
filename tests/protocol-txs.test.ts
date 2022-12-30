import { Emulator, Lucid } from "lucid-cardano";

import { assert } from "@/utils";

import { testBootstrapProtocolTx } from "./protocol-txs/bootstrap";
import { generateAccount } from "./utils";

const ACCOUNT = await generateAccount();

const emulator = new Emulator([ACCOUNT]);

const lucid = await Lucid.new(emulator);

lucid.selectWalletFromSeed(ACCOUNT.seedPhrase);

describe("Protocol transactions", () => {
  test("Bootstrap transaction", async () => {
    const txHash = await testBootstrapProtocolTx(lucid);

    assert(txHash.length === 64, "Fail to bootstrap protocol");
  });
});
