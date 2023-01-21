import { UplcProgram } from "@hyperionbt/helios";
import { OutRef } from "lucid-cardano";

import getBackingV, {
  Params as BackingVParams,
} from "@/contracts/backing/backing.v/main";
import getProofOfBackingMp, {
  Params as ProofOfBackingMpParams,
} from "@/contracts/backing/proof-of-backing.mp/main";
import { compile } from "@/contracts/compile";
import getTeikiPlantNft from "@/contracts/meta-protocol/teiki-plant.nft/main";
import getTeikiPlantV, {
  Params as TeikiPlantVParams,
} from "@/contracts/meta-protocol/teiki-plant.v/main";
import getTeikiMp from "@/contracts/meta-protocol/teiki.mp/main";
import getProjectDetailV, {
  Params as ProjectDetailVParams,
} from "@/contracts/project/project-detail.v/main";
import getProjectScriptV, {
  Params as ProjectScriptVParams,
} from "@/contracts/project/project-script.v/main";
import getProjectAt, {
  Params as ProjectAtMpParams,
} from "@/contracts/project/project.at/main";
import getProjectSv, {
  Params as ProjectSvParams,
} from "@/contracts/project/project.sv/main";
import getProjectV, {
  Params as ProjectVParams,
} from "@/contracts/project/project.v/main";
import getProtocolParamsV, {
  Params as ProtocolParamsVParams,
} from "@/contracts/protocol/protocol-params.v/main";
import getProtocolProposalV, {
  Params as ProtocolProposalVParams,
} from "@/contracts/protocol/protocol-proposal.v/main";
import getProtocolScriptV, {
  Params as ProtocolScriptVParams,
} from "@/contracts/protocol/protocol-script.v/main";
import getProtocolNft, {
  Params as ProtocolNftMpParams,
} from "@/contracts/protocol/protocol.nft/main";
import getProtocolSv, {
  Params as ProtocolSvParams,
} from "@/contracts/protocol/protocol.sv/main";
import getSampleMigrateTokenMp, {
  Params as SampleMigrateTokenMpParams,
} from "@/contracts/sample-migration/sample-migrate-token.mp/main";
import getDedicatedTreasuryV, {
  Params as DedicatedTreasuryVParams,
} from "@/contracts/treasury/dedicated-treasury.v/main";
import getOpenTreasuryV, {
  Params as OpenTreasuryVParams,
} from "@/contracts/treasury/open-treasury.v/main";
import getSharedTreasuryV, {
  Params as SharedTreasuryVParams,
} from "@/contracts/treasury/shared-treasury.v/main";
import { Hex } from "@/types";

export function compileProtocolNftScript(
  params: ProtocolNftMpParams
): UplcProgram {
  return compile(getProtocolNft(params));
}

export function compileProtocolParamsVScript(
  params: ProtocolParamsVParams
): UplcProgram {
  return compile(getProtocolParamsV(params));
}

export function compileProtocolScriptVScript(
  params: ProtocolScriptVParams
): UplcProgram {
  return compile(getProtocolScriptV(params));
}

export function compileProtocolProposalVScript(
  params: ProtocolProposalVParams
): UplcProgram {
  return compile(getProtocolProposalV(params));
}

export function compileProtocolSvScript(params: ProtocolSvParams): UplcProgram {
  return compile(getProtocolSv(params));
}

export function compileProjectsAtMpScript(
  params: ProjectAtMpParams
): UplcProgram {
  return compile(getProjectAt(params));
}

export function compileProjectVScript(params: ProjectVParams): UplcProgram {
  return compile(getProjectV(params));
}

export function compileProjectDetailVScript(
  params: ProjectDetailVParams
): UplcProgram {
  return compile(getProjectDetailV(params));
}

export function compileProjectScriptVScript(
  params: ProjectScriptVParams
): UplcProgram {
  return compile(getProjectScriptV(params));
}

export function compileProjectSvScript(params: ProjectSvParams): UplcProgram {
  return compile(getProjectSv(params));
}

export function compileTeikiPlantVScript(
  params: TeikiPlantVParams
): UplcProgram {
  return compile(getTeikiPlantV(params));
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
  params: ProofOfBackingMpParams
): UplcProgram {
  return compile(getProofOfBackingMp(params));
}

export function compileBackingVScript(params: BackingVParams): UplcProgram {
  return compile(getBackingV(params));
}

export function compileDedicatedTreasuryVScript(
  params: DedicatedTreasuryVParams
): UplcProgram {
  return compile(getDedicatedTreasuryV(params));
}

export function compileOpenTreasuryVScript(
  params: OpenTreasuryVParams
): UplcProgram {
  return compile(getOpenTreasuryV(params));
}

export function compileSharedTreasuryVScript(
  params: SharedTreasuryVParams
): UplcProgram {
  return compile(getSharedTreasuryV(params));
}

export function compileSampleMigrateTokenMpScript(
  params: SampleMigrateTokenMpParams
): UplcProgram {
  return compile(getSampleMigrateTokenMp(params));
}
