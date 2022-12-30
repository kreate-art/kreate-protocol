import { Address, Lucid, fromText } from "lucid-cardano";

import {
  compileProtocolNftMpScript,
  compileProtocolParamsVScript,
  compileProtocolProposalVScript,
  compileProtocolSvScript,
} from "@/commands/compile-scripts";
import { getProtocolRegistry } from "@/commands/gen-protocol-params";
import { exportScript } from "@/contracts/compile";
import { signAndSubmit } from "@/lucid";
import {
  BootstrapProtocolParams,
  bootstrapProtocolTx,
} from "@/transactions/protocol/bootstrap";
import { assert } from "@/utils";

export async function testBootstrapProtocolTx(lucid: Lucid) {
  const governorAddress: Address = await lucid.wallet.address();

  const poolId = "pool1ve7vhcyde2d342wmqcwcudd906jk749t37y7fmz5e6mvgghrwh3";

  const mockHash = "00".repeat(28);

  const teikiPlantNftMph = mockHash;
  const migrateTokenMph = mockHash;

  const migrateTokenName = fromText("migration");

  const seedUtxo = (await lucid.wallet.getUtxos())[0];

  assert(seedUtxo, "Utxo is required to boostrap protocol");

  const protocolNftPolicy = exportScript(compileProtocolNftMpScript(seedUtxo));

  const protocolNftMph = lucid.utils.validatorToScriptHash(protocolNftPolicy);

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
    protocolNftPolicy,
    protocolParamsAddress,
    protocolProposalAddress,
    protocolStakeAddress,
    protocolStakeValidator,
  };

  const tx = bootstrapProtocolTx(lucid, params);

  const txComplete = await tx.complete();

  return await signAndSubmit(txComplete);
}
