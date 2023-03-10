import { Unit } from "lucid-cardano";

import {
  SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
  getProtocolRegistry,
} from "@/commands/generate-protocol-params";
import { getLucid } from "@/commands/utils";
import { PROTOCOL_NFT_TOKEN_NAMES } from "@/contracts/common/constants";
import { signAndSubmit } from "@/helpers/lucid";
import { constructAddress } from "@/helpers/schema";
import { ProtocolParamsDatum, Registry } from "@/schema/teiki/protocol";
import { proposeProtocolProposalTx } from "@/transactions/protocol/propose";
import { trimToSlot } from "@/utils";

const lucid = await getLucid();
const governorAddress = await lucid.wallet.address();

const currentProtocolNftMph =
  "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const currentTeikiPlantNftMph =
  "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

const proposalNftUnit: Unit =
  currentProtocolNftMph + PROTOCOL_NFT_TOKEN_NAMES.PROPOSAL;
const protocolProposalVAddress = "addr1xxxx";

const protocolParamsUtxo = (
  await lucid.utxosByOutRef([
    {
      txHash: "",
      outputIndex: 0,
    },
  ])
)[0];

const protocolProposalUtxo = (
  await lucid.utxosAtWithUnit(protocolProposalVAddress, proposalNftUnit)
)[0];

const protocolProposalRefScriptUtxo = (
  await lucid.utxosByOutRef([
    {
      txHash: "",
      outputIndex: 0,
    },
  ])
)[0];

const proposeMigrateTokenMph = "";
const proposeMigrateTokenName = "";

// NOTE: only need to attach the migration info to the current registry
const proposedRegistry: Registry = getProtocolRegistry(lucid, {
  protocolNftMph: currentProtocolNftMph,
  teikiPlantNftMph: currentTeikiPlantNftMph,
  migrationInfo: {
    migrateTokenMph: proposeMigrateTokenMph,
    migrateTokenName: proposeMigrateTokenName,
  },
});

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

const txValidUntil = trimToSlot(Date.now()) + 600_000;

const tx = proposeProtocolProposalTx(lucid, {
  protocolParamsUtxo,
  proposedProtocolParamsDatum,
  protocolProposalUtxo,
  protocolProposalRefScriptUtxo,
  txValidUntil,
});

const txComplete = await tx.complete();
const txHash = await signAndSubmit(txComplete);

await lucid.awaitTx(txHash);

console.log("txHash :>> ", txHash);
