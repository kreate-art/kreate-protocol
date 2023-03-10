import { Unit } from "lucid-cardano";

import { getLucid } from "@/commands/utils";
import { TEIKI_PLANT_NFT_TOKEN_NAME } from "@/contracts/common/constants";
import { signAndSubmit } from "@/helpers/lucid";
import { applyMetaProtocolProposalTx } from "@/transactions/meta-protocol/apply";
import { trimToSlot } from "@/utils";

const lucid = await getLucid();
const teikiPlantNftMph = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const teikiPlantNftUnit: Unit = teikiPlantNftMph + TEIKI_PLANT_NFT_TOKEN_NAME;
const teikiPlantAddress = "addr1xxxx";

const teikiPlantUtxo = (
  await lucid.utxosAtWithUnit(teikiPlantAddress, teikiPlantNftUnit)
)[0];

const teikiPlantScriptUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 0 }])
)[0];

const txTime = trimToSlot(Date.now());

const tx = applyMetaProtocolProposalTx(lucid, {
  teikiPlantUtxo,
  teikiPlantScriptUtxo,
  txTime,
});

const txComplete = await tx.complete();
const txHash = await signAndSubmit(txComplete);

await lucid.awaitTx(txHash);

console.log("txHash :>> ", txHash);
