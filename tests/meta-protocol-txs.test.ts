import { Emulator, Lucid } from "lucid-cardano";

import { compileTeikiPlantNftScript } from "@/commands/compile-scripts";
import { exportScript } from "@/contracts/compile";
import { TeikiPlantDatum } from "@/schema/teiki/meta-protocol";
import { getPaymentKeyHash, signAndSubmit } from "@/transactions/helpers/lucid";
import {
  bootstrapMetaProtocolTx,
  BootstrapMetaProtocolTxParams,
} from "@/transactions/meta-protocol/bootstrap";

import { generateAccount, generateBlake2b224Hash } from "./emulator";

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
});
