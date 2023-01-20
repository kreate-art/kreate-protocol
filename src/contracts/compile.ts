import { UplcProgram, bytesToHex } from "@hyperionbt/helios";
import { Data, Script } from "lucid-cardano";

import { toDataJson } from "@/schema";
import { Hex } from "@/types";

import modBackingVTypes from "./backing/backing.v/types";
import modProofOfBackingMpTypes from "./backing/proof-of-backing.mp/types";
import modConstants from "./common/constants";
import modFraction from "./common/fraction";
import modHelpers from "./common/helpers";
import modCommonTypes from "./common/types";
import modTeikiPlantNftTypes from "./meta-protocol/teiki-plant.nft/types";
import modTeikiPlantVTypes from "./meta-protocol/teiki-plant.v/types";
import modTeikiMpTypes from "./meta-protocol/teiki.mp/types";
import { heliosModules, HeliosSource, newProgram } from "./program";
import modProjectDetailVTypes from "./project/project-detail.v/types";
import modProjectScriptVTypes from "./project/project-script.v/types";
import modProjectAtTypes from "./project/project.at/types";
import modProjectVTypes from "./project/project.v/types";
import modProtocolParamsVTypes from "./protocol/protocol-params.v/types";
import modProtocolProposalVTypes from "./protocol/protocol-proposal.v/types";
import modProtocolNftTypes from "./protocol/protocol.nft/types";
import modDedicatedTreasuryVTypes from "./treasury/dedicated-treasury.v/types";
import modOpenTreasuryVTypes from "./treasury/open-treasury.v/types";
import modSharedTreasuryVTypes from "./treasury/shared-treasury.v/types";

type CompileOptions = {
  simplify?: boolean;
  parameters?: Record<string, Data>;
};

let defaultOptions: Omit<CompileOptions, "parameters"> = {};

export function setDefaultOptions(
  options: Omit<CompileOptions, "parameters">,
  replace = false
) {
  if (replace) defaultOptions = options;
  else defaultOptions = { ...defaultOptions, ...options };
}

setDefaultOptions({ simplify: false });

const HELIOS_MODULES = heliosModules([
  modConstants,
  modCommonTypes,
  modFraction,
  modHelpers,
  modTeikiMpTypes,
  modTeikiPlantNftTypes,
  modTeikiPlantVTypes,
  modProtocolParamsVTypes,
  modProtocolProposalVTypes,
  modProtocolNftTypes,
  modProjectAtTypes,
  modProjectVTypes,
  modProjectDetailVTypes,
  modProjectScriptVTypes,
  modBackingVTypes,
  modProofOfBackingMpTypes,
  modDedicatedTreasuryVTypes,
  modSharedTreasuryVTypes,
  modOpenTreasuryVTypes,
]);

// TODO: Optimize compilation time by loading only needed modules
export function compile(
  main: HeliosSource,
  options?: CompileOptions
): UplcProgram {
  const opts = { ...defaultOptions, ...options };
  const program = newProgram(main, HELIOS_MODULES);
  if (opts.parameters)
    Object.entries(opts.parameters).forEach(([name, value]) =>
      program.changeParam(name, toDataJson(value))
    );
  return program.compile(opts.simplify);
}

export function exportScript(uplcProgram: UplcProgram): Script {
  return {
    type: "PlutusV2" as const,
    script: serialize(uplcProgram),
  };
}

export function serialize(uplcProgram: UplcProgram): Hex {
  return bytesToHex(uplcProgram.toCbor());
}
