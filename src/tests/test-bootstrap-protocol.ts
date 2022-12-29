import { fromHex, Lucid, utf8ToHex, UTxO } from "lucid-cardano";

import { getProtocolNftPolicySource } from "@/contracts/protocol/Nfts/script";
import { getProtocolParamsValidatorSource } from "@/contracts/protocol/ParamsValidator/script";
import { getProtocolProposalValidatorSource } from "@/contracts/protocol/ProposalValidator/script";
import { getProtocolStakeSource } from "@/contracts/protocol/ProtocolStake/script";
import {
  MigratableScript,
  ProtocolParamsDatum,
  Registry,
} from "@/schema/teiki/protocol";
import {
  constructMigratableScript,
  constructScriptHash,
} from "@/transactions/helpers/constructors";
import {
  BootstrapProtocolParams,
  bootstrapProtocolTx,
} from "@/transactions/protocol/bootstrap";

import { exportScript, getLucid, signAndSubmit } from "./lucid";

export async function testBootstrapProtocolTx(lucid: Lucid) {
  const seedUtxo = (await lucid.wallet.getUtxos()).filter((utxo: UTxO) => {
    return utxo.assets.lovelace > BigInt(2000000);
  })[0];
  if (!seedUtxo) throw new Error("Utxo is required to deploy NFT contract");

  const protocolNftPolicy = exportScript(
    getProtocolNftPolicySource(seedUtxo.txHash, seedUtxo.outputIndex.toString())
  );

  const protocolNftMPH = lucid.utils.validatorToScriptHash(protocolNftPolicy);

  const protocolStakeCredential = lucid.utils.scriptHashToCredential(
    lucid.utils.validatorToScriptHash(
      exportScript(getProtocolStakeSource(protocolNftMPH))
    )
  );

  const protocolParamsAddress = lucid.utils.validatorToAddress(
    exportScript(getProtocolParamsValidatorSource(protocolNftMPH)),
    protocolStakeCredential
  );
  const protocolProposalAddress = lucid.utils.validatorToAddress(
    exportScript(getProtocolProposalValidatorSource(protocolNftMPH)),
    protocolStakeCredential
  );

  const sampleMigratableScript: MigratableScript = constructMigratableScript(
    "eb91783097517294b44cecb55e83c4f3aae7cc27fd8f8553f146c6db",
    {
      eb91783097517294b44cecb55e83c4f3aae7cc27fd8f8553f146c6db: {
        mintingPolicyHash:
          "78e8bdde1f6182d9cc8cffbd03e6f287071b4ca3286d499d9ee0eda6",
        tokenName: utf8ToHex("migration"),
      },
    }
  );

  const registry: Registry = {
    protocolStakingValidator: constructScriptHash(
      "eb91783097517294b44cecb55e83c4f3aae7cc27fd8f8553f146c6db"
    ),
    projectValidator: sampleMigratableScript,
    projectDetailValidator: sampleMigratableScript,
    projectScriptValidator: sampleMigratableScript,
    backingValidator: sampleMigratableScript,
    dedicatedTreasuryValidator: sampleMigratableScript,
    sharedTreasuryValidator: sampleMigratableScript,
    openTreasuryValidator: sampleMigratableScript,
  };

  const protocolParamsDatum: ProtocolParamsDatum = {
    registry,
    // TODO: @sk-saru: helper function
    governorAddress: {
      paymentCredential: {
        paymentType: "PubKey",
        $: {
          pubKeyHash: {
            $hash: fromHex(
              "eb91783097517294b44cecb55e83c4f3aae7cc27fd8f8553f146c6db"
            ),
          },
        },
      },
      stakingCredential: {
        stakingType: "Hash",
        $: {
          stakingHash: "Validator",
          $: {
            scriptHash: {
              $hash: fromHex(
                "eb91783097517294b44cecb55e83c4f3aae7cc27fd8f8553f146c6db"
              ),
            },
          },
        },
      },
    },
    governorShareRatio: 600_000n,
    protocolFundsShareRatio: 600_000n,
    discountCentPrice: 10_000n,
    projectMilestones: [1_000_000n, 10_000_000n, 100_000_000n],
    teikiCoefficient: 500n,
    projectTeikiBurnRate: 600_000n,
    epochLength: { milliseconds: 10_000n },
    projectPledge: 50_000_000n,
    projectCreationFee: 20_000_000n,
    projectSponsorshipFee: 10_000_000n,
    projectSponsorshipDuration: { milliseconds: 10_000n },
    projectInformationUpdateFee: 10_000_000n,
    projectCommunityUpdateFee: 10_000_000n,
    minTreasuryPerMilestoneEvent: 20_000_000n,
    stakeKeyDeposit: 30_000_000n,
    proposalWaitingPeriod: { milliseconds: 10_000n },
    projectDelistWaitingPeriod: { milliseconds: 10_000n },
  };

  const params: BootstrapProtocolParams = {
    protocolParamsDatum,
    seedUtxo,
    protocolNftPolicy,
    protocolParamsAddress,
    protocolProposalAddress,
  };

  const tx = bootstrapProtocolTx(lucid, params);

  const txComplete = await tx.complete();

  const txHash = await signAndSubmit(txComplete);

  console.log("txHash :>> ", txHash);
}

const lucid = await getLucid();

await testBootstrapProtocolTx(lucid);
