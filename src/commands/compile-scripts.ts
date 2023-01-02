import { UplcProgram } from "@hyperionbt/helios";
import { UTxO } from "lucid-cardano";

import getBackingV from "@/contracts/backing/backing.v/main";
import getProofOfBackingMp from "@/contracts/backing/proof-of-backing.mp/main";
import { compile } from "@/contracts/compile";
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

// TODO: @sk-saru, @sk-umiuma: Use Hex for all those script hash params,
// both this file and the contracts.

export function compileProtocolNftScript(seedUtxo: UTxO): UplcProgram {
  return compile(getProtocolNft({ protocolSeed: seedUtxo }));
}

export function compileProtocolParamsVScript(
  protocolNftMph: string
): UplcProgram {
  return compile(getProtocolParamsV(protocolNftMph));
}

export function compileProtocolProposalVScript(
  protocolNftMph: string
): UplcProgram {
  return compile(getProtocolProposalV(protocolNftMph));
}

export function compileProjectsAtScript(protocolNftMph: string): UplcProgram {
  return compile(getProjectAt(protocolNftMph));
}

export function compileProtocolSvScript(protocolNftMph: string): UplcProgram {
  return compile(getProtocolSv(protocolNftMph));
}

export function compileProjectVScript(
  projectsAuthTokenMph: string,
  protocolNftMph: string
): UplcProgram {
  return compile(getProjectV({ projectsAuthTokenMph, protocolNftMph }));
}

export function compileProjectDetailVScript(
  projectsAuthTokenMph: string,
  protocolNftMph: string
): UplcProgram {
  return compile(getProjectDetailV({ projectsAuthTokenMph, protocolNftMph }));
}

export function compileProjectScriptVScript(
  projectsAuthTokenMph: string,
  protocolNftMph: string
): UplcProgram {
  return compile(getProjectV({ projectsAuthTokenMph, protocolNftMph }));
}

export function compileTeikiMpScript(nftTeikiPlantMph: string): UplcProgram {
  return compile(getTeikiMp({ nftTeikiPlantMph }));
}

export function compileProofOfBackingMpScript(
  projectsAuthTokenMph: string,
  protocolNftMph: string,
  teikiMph: string
): UplcProgram {
  return compile(
    getProofOfBackingMp({ projectsAuthTokenMph, protocolNftMph, teikiMph })
  );
}

export function compileBackingVScript(
  proofOfBackingMph: string,
  protocolNftMph: string
): UplcProgram {
  return compile(getBackingV({ proofOfBackingMph, protocolNftMph }));
}

export function compileDedicatedTreasuryVScript(
  projectsAuthTokenMph: string,
  protocolNftMph: string
): UplcProgram {
  return compile(
    getDedicatedTreasuryV({ projectsAuthTokenMph, protocolNftMph })
  );
}

export function compileSharedTreasuryVScript(
  protocolNftMph: string
): UplcProgram {
  return compile(getOpenTreasuryV(protocolNftMph));
}

export function compileOpenTreasuryVScript(
  projectsAuthTokenMph: string,
  protocolNftMph: string,
  teikiMph: string
): UplcProgram {
  return compile(
    getSharedTreasuryV({ projectsAuthTokenMph, protocolNftMph, teikiMph })
  );
}
