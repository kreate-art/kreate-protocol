import { UplcProgram } from "@hyperionbt/helios";
import { OutRef, UTxO } from "lucid-cardano";

import getBackingV from "@/contracts/backing/backing.v/main";
import getProofOfBackingMp from "@/contracts/backing/proof-of-backing.mp/main";
import { compile } from "@/contracts/compile";
import getTeikiPlantNft from "@/contracts/meta-protocol/teiki-plant.nft/main";
import getTeikiPlantV from "@/contracts/meta-protocol/teiki-plant.v/main";
import getTeikiMp from "@/contracts/meta-protocol/teiki.mp/main";
import getProjectDetailV from "@/contracts/project/project-detail.v/main";
import getProjectScriptV from "@/contracts/project/project-script.v/main";
import getProjectAt from "@/contracts/project/project.at/main";
import getProjectSv from "@/contracts/project/project.sv/main";
import getProjectV from "@/contracts/project/project.v/main";
import getProtocolParamsV from "@/contracts/protocol/protocol-params.v/main";
import getProtocolProposalV from "@/contracts/protocol/protocol-proposal.v/main";
import getProtocolScriptV from "@/contracts/protocol/protocol-script.v/main";
import getProtocolNft from "@/contracts/protocol/protocol.nft/main";
import getProtocolSv from "@/contracts/protocol/protocol.sv/main";
import getSampleMigrateTokenMp from "@/contracts/sample-migration/sample-migrate-token.mp/main";
import getDedicatedTreasuryV from "@/contracts/treasury/dedicated-treasury.v/main";
import getOpenTreasuryV from "@/contracts/treasury/open-treasury.v/main";
import getSharedTreasuryV, {
  SharedTreasuryParams,
} from "@/contracts/treasury/shared-treasury.v/main";
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
  projectAtMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(getProjectV({ projectAtMph, protocolNftMph }));
}

export function compileProjectDetailVScript(
  projectAtMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(getProjectDetailV({ projectAtMph, protocolNftMph }));
}

export function compileProjectScriptVScript(
  projectAtMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(getProjectScriptV({ projectAtMph, protocolNftMph }));
}

export function compileProjectSvScript(
  projectId: Hex,
  _stakingSeed: string,
  projectAtMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(
    getProjectSv({
      projectId,
      _stakingSeed,
      projectAtMph,
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
  projectAtMph: Hex,
  protocolNftMph: Hex,
  teikiMph: Hex
): UplcProgram {
  return compile(
    getProofOfBackingMp({ projectAtMph, protocolNftMph, teikiMph })
  );
}

export function compileBackingVScript(
  proofOfBackingMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(getBackingV({ proofOfBackingMph, protocolNftMph }));
}

export function compileDedicatedTreasuryVScript(
  projectAtMph: Hex,
  protocolNftMph: Hex
): UplcProgram {
  return compile(getDedicatedTreasuryV({ projectAtMph, protocolNftMph }));
}

export function compileOpenTreasuryVScript(protocolNftMph: Hex): UplcProgram {
  return compile(getOpenTreasuryV(protocolNftMph));
}

export function compileSharedTreasuryVScript(
  params: SharedTreasuryParams
): UplcProgram {
  return compile(getSharedTreasuryV(params));
}

export function compileSampleMigrateTokenMpScript(
  governorPkh: Hex
): UplcProgram {
  return compile(getSampleMigrateTokenMp(governorPkh));
}
