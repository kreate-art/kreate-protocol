/* eslint-disable @typescript-eslint/no-explicit-any */
import { Lucid } from "lucid-cardano";

import { compile, exportScript } from "@/contracts/compile";
import { getPaymentKeyHash, signAndSubmit } from "@/helpers/lucid";
import { TeikiPlantDatum } from "@/schema/teiki/meta-protocol";
import { Registry } from "@/schema/teiki/protocol";
import {
  BootstrapMetaProtocolTxParams,
  bootstrapMetaProtocolTx,
} from "@/transactions/meta-protocol/bootstrap";
import {
  BootstrapProtocolParams,
  bootstrapProtocolTx,
} from "@/transactions/protocol/bootstrap";
import { Hex } from "@/types";

import {
  compileTeikiPlantNftScript,
  compileTeikiPlantVScript,
  compileTeikiMpScript,
  compileProtocolNftScript,
  compileProjectsAtMpScript,
  compileProtocolSvScript,
  compileProtocolParamsVScript,
  compileProtocolProposalVScript,
  compileProjectVScript,
  compileProjectDetailVScript,
  compileProjectScriptVScript,
  compileProofOfBackingMpScript,
  compileBackingVScript,
  compileDedicatedTreasuryVScript,
  compileSharedTreasuryVScript,
  compileOpenTreasuryVScript,
  compileSampleMigrateTokenMpScript,
  compileProtocolScriptVScript,
} from "../commands/compile-scripts";
import {
  SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
  getProtocolRegistry,
} from "../commands/generate-protocol-params";
import { getLucid } from "../commands/utils";

import {
  sleep,
  alwaysFalse,
  deployReferencedScript,
  printScriptHash,
} from "./utils";

// =======================BOOTSTRAP==========================
// Protocol staking
const POOL_ID = "pool1z9nsz7wyyxc5r8zf8pf774p9gry09yxtrlqlg5tsnjndv5xupu3";

// Staking manager address - only use payment credential
const STAKING_MANAGER_ADDRESS =
  "addr_test1qr96lcz9ac5ujtkwxzwgc8u276hcm5zp8u82hvgkh7spcwl6vq0xp4mj8q472g22vfpp5n3mgcxwlrm0dqd4uuch2cqqug4st7";

const lucid = await getLucid();

const teikiPlantNftPolicy = await runBootstrapMetaProtocol(lucid);

// wait for several minutes to ensure wallet UTxOs is updated
// check why lucid.awaitTx() not working as expected
await sleep(60_000);

const teikiPlantNftMph = lucid.utils.validatorToScriptHash(teikiPlantNftPolicy);

const scripts = await runBootstapProtocol(lucid, teikiPlantNftMph);

const protocolNftMph = lucid.utils.validatorToScriptHash(
  scripts.PROTOCOL_NFT_MPH
);

await sleep(60_000);

// ==============DEPLOY REFERENCE ScRIPTS=====================
const metaProtocolScripts = {
  TEIKI_PLANT_V_SCRIPT_HASH: exportScript(
    compileTeikiPlantVScript({ teikiPlantNftMph })
  ),
  TEIKI_MPH: exportScript(compileTeikiMpScript({ teikiPlantNftMph })),
};

const protocolScripts = {
  PROTOCOL_SV_SCRIPT_HASH: scripts.PROTOCOL_SV_SCRIPT_HASH,
  PROTOCOL_PARAMS_V_SCRIPT_HASH: scripts.PROTOCOL_PARAMS_V_SCRIPT_HASH,
  PROTOCOL_PROPOSAL_V_SCRIPT_HASH: scripts.PROTOCOL_PROPOSAL_V_SCRIPT_HASH,
  PROTOCOL_SCRIPT_V_SCRIPT_HASH: scripts.PROTOCOL_SCRIPT_V_SCRIPT_HASH,
};

const remainingScripts = {
  PROJECT_AT_MPH: scripts.PROJECT_AT_MPH,
  PROJECT_DETAIL_V_SCRIPT_HASH: scripts.PROJECT_DETAIL_V_SCRIPT_HASH,
  PROJECT_SCRIPT_V_SCRIPT_HASH: scripts.PROJECT_SCRIPT_V_SCRIPT_HASH,
  PROJECT_V_SCRIPT_HASH: scripts.PROJECT_V_SCRIPT_HASH,
  PROOF_OF_BACKING_MPH: scripts.PROOF_OF_BACKING_MPH,
  BACKING_V_SCRIPT_HASH: scripts.BACKING_V_SCRIPT_HASH,
  DEDICATED_TREASURY_V_SCRIPT_HASH: scripts.DEDICATED_TREASURY_V_SCRIPT_HASH,
  SHARED_TREASURY_V_SCRIPT_HASH: scripts.SHARED_TREASURY_V_SCRIPT_HASH,
  OPEN_TREASURY_V_SCRIPT_HASH: scripts.OPEN_TREASURY_V_SCRIPT_HASH,
  SAMPLE_MIGRATE_TOKEN_MPH: scripts.SAMPLE_MIGRATE_TOKEN_MPH,
};

const alwaysFalseVScript = exportScript(compile(alwaysFalse()));
const alwaysFalseAddress = lucid.utils.validatorToAddress(alwaysFalseVScript);
console.log("=======================================================");
console.log(
  `ALWAYS_FAIL_SCRIPT_HASH=${lucid.utils.validatorToScriptHash(
    alwaysFalseVScript
  )}`
);
console.log("=======================================================");

const protocolScriptVAddress = lucid.utils.validatorToAddress(
  scripts.PROTOCOL_SCRIPT_V_SCRIPT_HASH,
  lucid.utils.scriptHashToCredential(
    lucid.utils.validatorToScriptHash(scripts.PROTOCOL_SV_SCRIPT_HASH)
  )
);

await deployReferencedScript(
  lucid,
  Object.values({ ...metaProtocolScripts, ...protocolScripts }),
  alwaysFalseAddress
);
await sleep(60_000);

console.log("\n=============== Meta protocol scripts: ================\n");
console.log(`TEIKI_PLANT_NFT_MPH=${teikiPlantNftMph}`);
printScriptHash(lucid, metaProtocolScripts);
console.log("=======================================================");

console.log("\n=============== Protocol scripts: =====================\n");
console.log(`PROTOCOL_NFT_MPH=${protocolNftMph}`);
printScriptHash(lucid, protocolScripts);
console.log("=======================================================");

await deployReferencedScript(
  lucid,
  Object.values(remainingScripts),
  protocolScriptVAddress
);

console.log("\n=============== Remaining scripts: ====================\n");
printScriptHash(lucid, remainingScripts);
console.log("=======================================================");
// ==========================================================

async function runBootstrapMetaProtocol(lucid: Lucid) {
  const governorAddress = await lucid.wallet.address();
  const seedUtxo = (await lucid.wallet.getUtxos())[0];

  const teikiPlantNftPolicy = exportScript(
    compileTeikiPlantNftScript(seedUtxo)
  );

  const teikiPlantNftMph =
    lucid.utils.validatorToScriptHash(teikiPlantNftPolicy);

  const teikiPlantVScript = exportScript(
    compileTeikiPlantVScript({ teikiPlantNftMph })
  );

  const teikiPlantAddress = lucid.utils.validatorToAddress(teikiPlantVScript);

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
      proposalWaitingPeriod:
        SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS.proposalWaitingPeriod,
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

  console.log("Submit bootstrap meta protcol transaction...\n");
  const txHash = await signAndSubmit(txComplete);

  console.log("Wait for confirmations...\n");
  const result = await lucid.awaitTx(txHash);

  console.log(
    `Bootstrap meta protcol transaction ${result} and txHash: ${txHash}\n`
  );

  return teikiPlantNftPolicy;
}

async function runBootstapProtocol(lucid: Lucid, teikiPlantNftMph: Hex) {
  const governorAddress = await lucid.wallet.address();
  const seedUtxo = (await lucid.wallet.getUtxos())[0];

  const teikiMintingPolicy = exportScript(
    compileTeikiMpScript({ teikiPlantNftMph })
  );
  const teikiMph = lucid.utils.validatorToScriptHash(teikiMintingPolicy);

  const protocolNftScript = exportScript(
    compileProtocolNftScript({ protocolSeed: seedUtxo })
  );
  const protocolNftMph = lucid.utils.validatorToScriptHash(protocolNftScript);

  const projectAtScript = exportScript(
    compileProjectsAtMpScript({ protocolNftMph })
  );
  const projectAtMph = lucid.utils.validatorToScriptHash(projectAtScript);

  const protocolSvScript = exportScript(
    compileProtocolSvScript({ protocolNftMph })
  );
  const protocolParamsVScript = exportScript(
    compileProtocolParamsVScript({ protocolNftMph })
  );
  const protocolProposalVScript = exportScript(
    compileProtocolProposalVScript({ protocolNftMph })
  );
  const protocolScriptVScript = exportScript(
    compileProtocolScriptVScript({ protocolNftMph })
  );
  const projectVScript = exportScript(
    compileProjectVScript({ projectAtMph, protocolNftMph })
  );
  const projectDetailVScript = exportScript(
    compileProjectDetailVScript({ projectAtMph, protocolNftMph })
  );
  const projectScriptVScript = exportScript(
    compileProjectScriptVScript({ projectAtMph, protocolNftMph })
  );
  const proofOfBackingMpScript = exportScript(
    compileProofOfBackingMpScript({ projectAtMph, protocolNftMph, teikiMph })
  );
  const proofOfBackingMph = lucid.utils.validatorToScriptHash(
    proofOfBackingMpScript
  );
  const backingVScript = exportScript(
    compileBackingVScript({ proofOfBackingMph, protocolNftMph })
  );
  const dedicatedTreasuryVScript = exportScript(
    compileDedicatedTreasuryVScript({ projectAtMph, protocolNftMph })
  );
  const sharedTreasuryVScript = exportScript(
    compileSharedTreasuryVScript({
      projectAtMph,
      protocolNftMph,
      teikiMph,
      proofOfBackingMph,
    })
  );
  const openTreasuryVScript = exportScript(
    compileOpenTreasuryVScript({ protocolNftMph })
  );

  const protocolParamsVHash = lucid.utils.validatorToScriptHash(
    protocolParamsVScript
  );

  const protocolSvHash = lucid.utils.validatorToScriptHash(protocolSvScript);
  const protocolProposalVHash = lucid.utils.validatorToScriptHash(
    protocolProposalVScript
  );

  const protocolStakeCredential =
    lucid.utils.scriptHashToCredential(protocolSvHash);

  const protocolStakeAddress = lucid.utils.credentialToRewardAddress(
    protocolStakeCredential
  );

  const protocolParamsAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(protocolParamsVHash),
    protocolStakeCredential
  );
  const protocolProposalAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(protocolProposalVHash),
    protocolStakeCredential
  );

  const sampleMigrateTokenPolicy = exportScript(
    compileSampleMigrateTokenMpScript({
      governorPkh: getPaymentKeyHash(governorAddress),
    })
  );

  const registry: Registry = getProtocolRegistry(lucid, {
    protocolNftMph,
    teikiPlantNftMph,
  });

  const params: BootstrapProtocolParams = {
    protocolParams: SAMPLE_PROTOCOL_NON_SCRIPT_PARAMS,
    seedUtxo: seedUtxo,
    governorAddress,
    stakingManagerAddress: STAKING_MANAGER_ADDRESS,
    poolId: POOL_ID,
    registry,
    protocolNftScript,
    protocolParamsAddress,
    protocolProposalAddress,
    protocolStakeAddress,
    protocolStakeValidator: protocolSvScript,
  };

  const tx = bootstrapProtocolTx(lucid, params);

  const txComplete = await tx.complete();
  console.log("Submit bootstrap protcol transaction...\n");
  const txHash = await signAndSubmit(txComplete);

  console.log("Wait for confirmations...\n");
  const result = await lucid.awaitTx(txHash);

  console.log(
    `Bootstrap protcol transaction ${result} and txHash: ${txHash}\n`
  );

  const scripts = {
    TEIKI_MPH: teikiMintingPolicy,
    PROTOCOL_NFT_MPH: protocolNftScript,
    PROTOCOL_SV_SCRIPT_HASH: protocolSvScript,
    PROTOCOL_PARAMS_V_SCRIPT_HASH: protocolParamsVScript,
    PROTOCOL_PROPOSAL_V_SCRIPT_HASH: protocolProposalVScript,
    PROTOCOL_SCRIPT_V_SCRIPT_HASH: protocolScriptVScript,
    PROJECT_AT_MPH: projectAtScript,
    PROJECT_DETAIL_V_SCRIPT_HASH: projectDetailVScript,
    PROJECT_SCRIPT_V_SCRIPT_HASH: projectScriptVScript,
    PROJECT_V_SCRIPT_HASH: projectVScript,
    PROOF_OF_BACKING_MPH: proofOfBackingMpScript,
    BACKING_V_SCRIPT_HASH: backingVScript,
    DEDICATED_TREASURY_V_SCRIPT_HASH: dedicatedTreasuryVScript,
    SHARED_TREASURY_V_SCRIPT_HASH: sharedTreasuryVScript,
    OPEN_TREASURY_V_SCRIPT_HASH: openTreasuryVScript,
    SAMPLE_MIGRATE_TOKEN_MPH: sampleMigrateTokenPolicy,
  };

  return scripts;
}
