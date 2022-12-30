import { UTxO } from "lucid-cardano";

import getBackingV from "@/contracts/backing/backing.v/main";
import getProofOfBackingMp from "@/contracts/backing/proof-of-backing.mp/main";
import getTeikiMp from "@/contracts/meta-protocol/teiki.mp/main";
import getProjectDetailV from "@/contracts/project/project-detail.v/main";
import getProjectAt from "@/contracts/project/project.at/main";
import getProjectV from "@/contracts/project/project.v/main";
import getProtocolParamsV from "@/contracts/protocol/protocol-params.v/main";
import getProtocolProposalV from "@/contracts/protocol/protocol-proposal.v/main";
import getProtocolNft from "@/contracts/protocol/protocol.nft/main";
import getProtocolSv from "@/contracts/protocol/protocol.sv/main";
import getDedicatedTreasuryV from "@/contracts/treasury/dedicated-treasury.v/main";
import getOpenTreasuryV from "@/contracts/treasury/open-treasury.v/main";
import getSharedTreasuryV from "@/contracts/treasury/shared-treasury.v/main";
import { exportScript } from "@/lucid";

export function getProtocolNftPolicy(seedUtxo: UTxO) {
  return exportScript(
    getProtocolNft(seedUtxo.txHash, seedUtxo.outputIndex.toString())
  );
}

export function getProtocolParamsValidator(protocolNftMph: string) {
  return exportScript(getProtocolParamsV(protocolNftMph));
}

export function getProtocolProposalValidator(protocolNftMph: string) {
  return exportScript(getProtocolProposalV(protocolNftMph));
}

export function getProjectsATMintingPolicy(protocolNftMph: string) {
  return exportScript(getProjectAt(protocolNftMph));
}

export function getProtocolStakeValidator(protocolNftMph: string) {
  return exportScript(getProtocolSv(protocolNftMph));
}

export function getProjectValidator(
  projectsAuthTokenMph: string,
  protocolNftMph: string
) {
  return exportScript(getProjectV({ projectsAuthTokenMph, protocolNftMph }));
}

export function getProjectDetailValidator(
  projectsAuthTokenMph: string,
  protocolNftMph: string
) {
  return exportScript(
    getProjectDetailV({ projectsAuthTokenMph, protocolNftMph })
  );
}

export function getProjectScriptValidator(
  projectsAuthTokenMph: string,
  protocolNftMph: string
) {
  return exportScript(getProjectV({ projectsAuthTokenMph, protocolNftMph }));
}

export function getTeikiMintingPolicy(nftTeikiPlantMph: string) {
  return exportScript(getTeikiMp({ nftTeikiPlantMph }));
}

export function getProofOfBackingMintingPolicy(
  projectsAuthTokenMph: string,
  protocolNftMph: string,
  teikiMph: string
) {
  return exportScript(
    getProofOfBackingMp({ projectsAuthTokenMph, protocolNftMph, teikiMph })
  );
}

export function getBackingValidator(
  proofOfBackingMph: string,
  protocolNftMph: string
) {
  return exportScript(getBackingV({ proofOfBackingMph, protocolNftMph }));
}

export function getDedicatedTreasuryValidator(
  projectsAuthTokenMph: string,
  protocolNftMph: string
) {
  return exportScript(
    getDedicatedTreasuryV({ projectsAuthTokenMph, protocolNftMph })
  );
}

export function getSharedTreasuryValidator(protocolNftMph: string) {
  return exportScript(getOpenTreasuryV(protocolNftMph));
}

export function getOpenTreasuryValidator(
  projectsAuthTokenMph: string,
  protocolNftMph: string,
  teikiMph: string
) {
  return exportScript(
    getSharedTreasuryV({ projectsAuthTokenMph, protocolNftMph, teikiMph })
  );
}
