import { Unit } from "lucid-cardano";

import { getLucid } from "@/commands/utils";
import { TEIKI_PLANT_NFT_TOKEN_NAME } from "@/contracts/common/constants";
import { signAndSubmit } from "@/helpers/lucid";
import * as S from "@/schema";
import { RulesProposal, TeikiPlantDatum } from "@/schema/teiki/meta-protocol";
import { proposeMetaProtocolProposalTx } from "@/transactions/meta-protocol/propose";
import { assert, trimToSlot } from "@/utils";

const lucid = await getLucid();
const teikiPlantNftMph = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const proofOfBackingMph = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const teikiPlantNftUnit: Unit = teikiPlantNftMph + TEIKI_PLANT_NFT_TOKEN_NAME;
const teikiPlantAddress = "addr1xxxx";

const teikiPlantUtxo = (
  await lucid.utxosAtWithUnit(teikiPlantAddress, teikiPlantNftUnit)
)[0];

const teikiPlantScriptUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 0 }])
)[0];

assert(
  teikiPlantUtxo.datum != null,
  "Invalid Teiki plant UTxO: Missing inline datum"
);
const teikiPlantDatum = S.fromData(
  S.fromCbor(teikiPlantUtxo.datum),
  TeikiPlantDatum
);

const proposedRules: RulesProposal = {
  inEffectAt: { timestamp: BigInt(Date.now() + 60000) },
  rules: {
    ...teikiPlantDatum.rules,
    teikiMintingRules: [
      {
        mintingPolicyHash: { script: { hash: proofOfBackingMph } },
        redeemer: { kind: "ConstrNotIn", constrs: [2n] },
      },
    ],
  },
};

const txValidUntil = trimToSlot(Date.now()) + 600_000;

const tx = proposeMetaProtocolProposalTx(lucid, {
  teikiPlantUtxo,
  teikiPlantScriptUtxo,
  proposedRules,
  txValidUntil,
});

const txComplete = await tx.complete();
const txHash = await signAndSubmit(txComplete);

await lucid.awaitTx(txHash);

console.log("txHash :>> ", txHash);
