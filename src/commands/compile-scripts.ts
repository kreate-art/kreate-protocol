import { UplcProgram } from "@hyperionbt/helios";
import { OutRef, UTxO } from "lucid-cardano";

import getBackingV from "@/contracts/backing/backing.v/main";
import getProofOfBackingMp from "@/contracts/backing/proof-of-backing.mp/main";
import { compile } from "@/contracts/compile";
import getTeikiPlantNft from "@/contracts/meta-protocol/teiki-plant.nft/main";
import getTeikiPlantV from "@/contracts/meta-protocol/teiki-plant.v/main";
import getTeikiMp from "@/contracts/meta-protocol/teiki.mp/main";
import getProjectDetailV from "@/contracts/project/project-detail.v/main";
import getProjectAt from "@/contracts/project/project.at/main";
import getProjectSv from "@/contracts/project/project.sv/main";
import getProjectV from "@/contracts/project/project.v/main";
import getProtocolParamsV from "@/contracts/protocol/protocol-params.v/main";
import getProtocolProposalV from "@/contracts/protocol/protocol-proposal.v/main";
import getProtocolScriptV from "@/contracts/protocol/protocol-script.v/main";
import getProtocolNft from "@/contracts/protocol/protocol.nft/main";
import getProtocolSv from "@/contracts/protocol/protocol.sv/main";
import getDedicatedTreasuryV from "@/contracts/treasury/dedicated-treasury.v/main";
import getOpenTreasuryV from "@/contracts/treasury/open-treasury.v/main";
import getSharedTreasuryV from "@/contracts/treasury/shared-treasury.v/main";
import { Hex } from "@/types";

// TODO: @sk-saru, @sk-umiuma: Use Hex for all those script hash params,
// both this file and the contracts.

export function compileProtocolNftScript(seedUtxo: UTxO): UplcProgram {
  return compile(getProtocolNft({ protocolSeed: seedUtxo }));
}

export function compileProtocolParamsVScript(protocolNftMph: Hex): UplcProgram {
  return compile(getProtocolParamsV(protocolNftMph));
}

export function compileProtocolScriptVScript(protocolNftMph: Hex): UplcProgram {
  return compile(getProtocolScriptV(protocolNftMph));
}

export function compileProtocolProposalVScript(
  protocolNftMph: Hex
): UplcProgram {
  return compile(getProtocolProposalV(protocolNftMph));
}

export function compileProtocolSvScript(protocolNftMph: Hex): UplcProgram {
  return compile(getProtocolSv(protocolNftMph));
}

export function compileProjectsAtScript(protocolNftMph: Hex): UplcProgram {
  return compile(getProjectAt(protocolNftMph));
}

export function compileProjectVScript(
  projectsAuthTokenMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(getProjectV({ projectsAuthTokenMph, protocolNftMph }));
}

export function compileProjectDetailVScript(
  projectsAuthTokenMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(getProjectDetailV({ projectsAuthTokenMph, protocolNftMph }));
}

export function compileProjectScriptVScript(
  projectsAuthTokenMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(getProjectV({ projectsAuthTokenMph, protocolNftMph }));
}

export function compileProjectSvScript(
  projectId: Hex,
  _stakingSeed: string,
  projectsAuthTokenMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(
    getProjectSv({
      projectId,
      _stakingSeed,
      projectsAuthTokenMph,
      protocolNftMph,
    })
  );
}

export function compileTeikiPlantVScript(teikiPlantNftMph: Hex): UplcProgram {
  return compile(getTeikiPlantV(teikiPlantNftMph));
}

export function compileTeikiPlantNftScript(
  teikiPlantSeed: OutRef
): UplcProgram {
  return compile(getTeikiPlantNft({ teikiPlantSeed }));
}

export function compileTeikiMpScript(nftTeikiPlantMph: Hex): UplcProgram {
  return compile(getTeikiMp({ nftTeikiPlantMph }));
}

export function compileProofOfBackingMpScript(
  projectsAuthTokenMph: Hex,
  protocolNftMph: Hex,
  teikiMph: Hex
): UplcProgram {
  return compile(
    getProofOfBackingMp({ projectsAuthTokenMph, protocolNftMph, teikiMph })
  );
}

export function compileBackingVScript(
  proofOfBackingMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(getBackingV({ proofOfBackingMph, protocolNftMph }));
}

export function compileDedicatedTreasuryVScript(
  projectsAuthTokenMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(
    getDedicatedTreasuryV({ projectsAuthTokenMph, protocolNftMph })
  );
}

export function compileSharedTreasuryVScript(protocolNftMph: Hex): UplcProgram {
  return compile(getOpenTreasuryV(protocolNftMph));
}

export function compileOpenTreasuryVScript(
  projectsAuthTokenMph: Hex,
  protocolNftMph: Hex,
  teikiMph: Hex
): UplcProgram {
  return compile(
    getSharedTreasuryV({ projectsAuthTokenMph, protocolNftMph, teikiMph })
  );
}
