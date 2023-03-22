/* eslint-disable @typescript-eslint/no-explicit-any */
import { Lucid, Script, Address } from "lucid-cardano";

import { HeliosScript, helios, header } from "@/contracts/program";
import { signAndSubmit } from "@/helpers/lucid";
import {
  DeployScriptParams,
  deployScriptsTx,
} from "@/transactions/deploy-scripts";

export async function deployReferencedScript(
  lucid: Lucid,
  scripts: Script[],
  referenceAddress: Address
) {
  console.log(`Deploying ${scripts.length} reference scripts ...`);

  const params: DeployScriptParams = {
    deployAddress: referenceAddress,
    scriptReferences: scripts,
    batchScriptSize: 15_000,
  };

  const txs = deployScriptsTx(lucid, params);

  console.log("number of transactions :>> ", txs.length);

  for (const tx of txs) {
    await sleep(60_000);
    const txComplete = await tx.complete();
    const txHash = await signAndSubmit(txComplete);
    const result = await lucid.awaitTx(txHash);
    console.log(result, txHash);
  }
}

export function alwaysFalse(): HeliosScript {
  return helios`
    ${header("spending", "v__locking")}

    func main() -> Bool {
      731211 == 731112
    }
  `;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function printScriptHash(lucid: Lucid, scripts: any) {
  for (const key of Object.keys(scripts)) {
    const script: any = scripts[key as keyof typeof scripts];
    console.log(`${key}=${lucid.utils.validatorToScriptHash(script)}`);
  }
}
