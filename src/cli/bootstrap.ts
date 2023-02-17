/* eslint-disable @typescript-eslint/no-explicit-any */
import { Address, Lucid, Script } from "lucid-cardano";

import { compile, exportScript } from "@/contracts/compile";
import { HeliosSource, helios } from "@/contracts/program";
import { getPaymentKeyHash, signAndSubmit } from "@/helpers/lucid";
import { TeikiPlantDatum } from "@/schema/teiki/meta-protocol";
import { Registry } from "@/schema/teiki/protocol";
import {
  DeployScriptParams,
  deployScriptsTx,
} from "@/transactions/deploy-scripts";
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
import { getLucid, requiredEnv } from "../commands/utils";

// =======================BOOTSTRAP==========================
// Protocol staking
const POOL_ID = requiredEnv("BLOCKFROST_URL");

// Staking manager address - only use payment credential
const STAKING_MANAGER_ADDRESS = requiredEnv("STAKING_MANAGER_ADDRESS");

const lucid = await getLucid();

const teikiPlantNftPolicy = await runBootstrapMetaProtocol(lucid);

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

async function deployReferencedScript(
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function alwaysFalse(): HeliosSource {
  return helios("v__locking", [])`
    spending v__locking

    func main() -> Bool {
      731211 == 731112
    }
  `;
}

function printScriptHash(lucid: Lucid, scripts: any) {
  for (const key of Object.keys(scripts)) {
    const script: any = scripts[key as keyof typeof scripts];
    console.log(`${key}=${lucid.utils.validatorToScriptHash(script)}`);
  }
}
