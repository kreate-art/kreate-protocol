import { UTxO } from "lucid-cardano";

import getBackingValidatorSource from "@/contracts/backing/backing.v/main";
import getProofOfBackingPolicy from "@/contracts/backing/proof-of-backing.mp/main";
import getTeikiPolicySource from "@/contracts/meta-protocol/teiki.mp/main";
import { getProjectATPolicySource } from "@/contracts/project/ProjectAT/script";
import { getProjectDetailValidatorSource } from "@/contracts/project/ProjectDetail/script";
import { getProjectScriptSource } from "@/contracts/project/ProjectScript/script";
import { getProjectValidatorSource } from "@/contracts/project/ProjectValidator/script";
import { getProtocolNftPolicySource } from "@/contracts/protocol/Nfts/script";
import { getProtocolParamsValidatorSource } from "@/contracts/protocol/ParamsValidator/script";
import { getProtocolProposalValidatorSource } from "@/contracts/protocol/ProposalValidator/script";
import { getProtocolStakeSource } from "@/contracts/protocol/ProtocolStake/script";
import { getDedicatedTreasuryValidatorSource } from "@/contracts/treasury/DedicatedTreasury/script";
import { getOpenTreasuryValidatorSource } from "@/contracts/treasury/OpenTreasury/script";
import { getSharedTreasuryValidatorSource } from "@/contracts/treasury/SharedTreasury/script";
import { exportScript } from "@/lucid";

export function getProtocolNftPolicy(seedUtxo: UTxO) {
  return exportScript(
    getProtocolNftPolicySource(seedUtxo.txHash, seedUtxo.outputIndex.toString())
  );
}

export function getProtocolParamsValidator(protocolNftMPH: string) {
  return exportScript(getProtocolParamsValidatorSource(protocolNftMPH));
}

export function getProtocolProposalValidator(protocolNftMPH: string) {
  return exportScript(getProtocolProposalValidatorSource(protocolNftMPH));
}

export function getProjectsATMintingPolicy(protocolNftMPH: string) {
  return exportScript(getProjectATPolicySource(protocolNftMPH));
}

export function getProtocolStakeValidator(protocolNftMPH: string) {
  return exportScript(getProtocolStakeSource(protocolNftMPH));
}

export function getProjectValidator(
  projectsAuthTokenMPH: string,
  protocolNftMPH: string
) {
  return exportScript(
    getProjectValidatorSource({ projectsAuthTokenMPH, protocolNftMPH })
  );
}

export function getProjectDetailValidator(
  projectsAuthTokenMPH: string,
  protocolNftMPH: string
) {
  return exportScript(
    getProjectDetailValidatorSource({ projectsAuthTokenMPH, protocolNftMPH })
  );
}

export function getProjectScriptValidator(
  projectsAuthTokenMPH: string,
  protocolNftMPH: string
) {
  return exportScript(
    getProjectScriptSource({ projectsAuthTokenMPH, protocolNftMPH })
  );
}

export function getTeikiMintingPolicy(nftTeikiPlantMph: string) {
  return exportScript(getTeikiPolicySource({ nftTeikiPlantMph }));
}

export function getProofOfBackingMintingPolicy(
  projectsAuthTokenMph: string,
  protocolNftMph: string,
  teikiMph: string
) {
  return exportScript(
    getProofOfBackingPolicy({
      projectsAuthTokenMph,
      protocolNftMph,
      teikiMph,
    })
  );
}

export function getBackingValidator(
  proofOfBackingMph: string,
  protocolNftMph: string
) {
  return exportScript(
    getBackingValidatorSource({
      proofOfBackingMph,
      protocolNftMph,
    })
  );
}

export function getDedicatedTreasuryValidator(
  projectsAuthTokenMPH: string,
  protocolNftMPH: string
) {
  return exportScript(
    getDedicatedTreasuryValidatorSource({
      projectsAuthTokenMPH,
      protocolNftMPH,
    })
  );
}

export function getSharedTreasuryValidator(protocolNftMPH: string) {
  return exportScript(getOpenTreasuryValidatorSource(protocolNftMPH));
}

export function getOpenTreasuryValidator(
  projectsAuthTokenMPH: string,
  protocolNftMPH: string,
  teikiMPH: string
) {
  return exportScript(
    getSharedTreasuryValidatorSource({
      projectsAuthTokenMPH,
      protocolNftMPH,
      teikiMPH,
    })
  );
}
