import { Address, Emulator, fromText, Lucid } from "lucid-cardano";

import {
  compileProtocolNftScript,
  compileProtocolParamsVScript,
  compileProtocolProposalVScript,
  compileProtocolSvScript,
} from "@/commands/compile-scripts";
import { getProtocolRegistry } from "@/commands/gen-protocol-params";
import { exportScript } from "@/contracts/compile";
import { signAndSubmit } from "@/transactions/helpers/lucid";
import {
  BootstrapProtocolParams,
  bootstrapProtocolTx,
} from "@/transactions/protocol/bootstrap";

import { generateAccount } from "./emulator";

const BOOTSTRAP_ACCOUNT = await generateAccount();
const emulator = new Emulator([BOOTSTRAP_ACCOUNT]);
const lucid = await Lucid.new(emulator);

describe("Protocol transactions", () => {
  test("Bootstrap tx", async () => {
    expect.assertions(2);

    lucid.selectWalletFromSeed(BOOTSTRAP_ACCOUNT.seedPhrase);

    const governorAddress: Address = await lucid.wallet.address();

    const poolId = "pool1ve7vhcyde2d342wmqcwcudd906jk749t37y7fmz5e6mvgghrwh3";

    const mockHash = "00".repeat(28);

    const teikiPlantNftMph = mockHash;
    const migrateTokenMph = mockHash;

    const migrateTokenName = fromText("migrate");

    const seedUtxo = (await lucid.wallet.getUtxos())[0];

    expect(seedUtxo).toBeTruthy();

    const protocolNftScript = exportScript(compileProtocolNftScript(seedUtxo));

    const protocolNftMph = lucid.utils.validatorToScriptHash(protocolNftScript);

    const protocolStakeValidator = exportScript(
      compileProtocolSvScript(protocolNftMph)
    );

    const protocolStakeCredential = lucid.utils.scriptHashToCredential(
      lucid.utils.validatorToScriptHash(protocolStakeValidator)
    );

    const protocolStakeAddress = lucid.utils.credentialToRewardAddress(
      protocolStakeCredential
    );

    const protocolParamsAddress = lucid.utils.validatorToAddress(
      exportScript(compileProtocolParamsVScript(protocolNftMph)),
      protocolStakeCredential
    );

    const protocolProposalAddress = lucid.utils.validatorToAddress(
      exportScript(compileProtocolProposalVScript(protocolNftMph)),
      protocolStakeCredential
    );

    const registry = getProtocolRegistry(
      lucid,
      seedUtxo,
      teikiPlantNftMph,
      migrateTokenMph,
      migrateTokenName
    );

    const params: BootstrapProtocolParams = {
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
});
