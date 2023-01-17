import {
  SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
  getProtocolRegistry,
} from "@/commands/generate-protocol-params";
import { getLucid } from "@/commands/utils";
import { signAndSubmit } from "@/helpers/lucid";
import { constructAddress } from "@/helpers/schema";
import { ProtocolParamsDatum, Registry } from "@/schema/teiki/protocol";
import { proposeProtocolProposalTx } from "@/transactions/protocol/propose";

const lucid = await getLucid();
const governorAddress = await lucid.wallet.address();

const protocolParamsUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const protocolProposalUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const protocolProposalRefScriptUtxo = (
  await lucid.utxosByOutRef([{ txHash: "", outputIndex: 1 }])
)[0];

const proposeProtocolNftMph = "";
const proposeTeikiPlantNftMph = "";
const proposeMigrateTokenMph = "";
const proposeMigrateTokenName = "";

const proposedRegistry: Registry = getProtocolRegistry(
  lucid,
  proposeProtocolNftMph,
  proposeTeikiPlantNftMph,
  proposeMigrateTokenMph,
  proposeMigrateTokenName
);

const proposedNonScriptParams = SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS;

const proposedGovernorAddress = governorAddress;
const proposedStakingManagerAddress = governorAddress;

const proposedProtocolParamsDatum: ProtocolParamsDatum = {
  registry: proposedRegistry,
  governorAddress: constructAddress(proposedGovernorAddress),
  stakingManager: constructAddress(proposedStakingManagerAddress)
    .paymentCredential,
  ...proposedNonScriptParams,
};

const tx = proposeProtocolProposalTx(lucid, {
  protocolParamsUtxo,
  proposedProtocolParamsDatum,
  protocolProposalUtxo,
  protocolProposalRefScriptUtxo,
});

const txComplete = await tx.complete();
const txHash = await signAndSubmit(txComplete);

await lucid.awaitTx(txHash);

console.log("txHash :>> ", txHash);
