import { Address, Data, Lucid, Script } from "lucid-cardano";

export type DeployScriptParams = {
  deployAddress: Address;
  scriptReferences: Script[];
  batchScriptSize: number;
};

function scriptSize(script: Script) {
  return Math.floor(script.script.length / 2);
}

function partition(scripts: Script[], batchScriptSize: number): Script[][] {
  const result: Script[][] = [];
  for (const script of scripts) {
    const batch = result.find(
      (row) =>
        row.reduce(
          (sumScriptSize, item) => sumScriptSize + scriptSize(item),
          0
        ) +
          scriptSize(script) <=
        batchScriptSize
    );
    if (batch) batch.push(script);
    else result.push([script]);
  }
  return result;
}

export function deployScriptsTx(
  lucid: Lucid,
  { deployAddress, scriptReferences, batchScriptSize }: DeployScriptParams
) {
  return partition(scriptReferences, batchScriptSize).map((scripts) =>
    scripts.reduce(
      (tx, script) =>
        tx.payToContract(
          deployAddress,
          { inline: Data.void(), scriptRef: script },
          {}
        ),
      lucid.newTx()
    )
  );
}
