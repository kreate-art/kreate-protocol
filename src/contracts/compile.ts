import { bytesToHex } from "@hyperionbt/helios";
import { Data } from "lucid-cardano";

import { toJson } from "@/schema";

import modBackingVTypes from "./backing/backing.v/types";
import modProofOfBackingMpTypes from "./backing/proof-of-backing.mp/types";
import modConstants from "./common/constants";
import modFraction from "./common/fraction";
import modHelpers from "./common/helpers";
import modCommonTypes from "./common/types";
import modTeikiPlantNftTypes from "./meta-protocol/teiki-plant.nft/types";
import modTeikiPlantVTypes from "./meta-protocol/teiki-plant.v/types";
import modTeikiMpTypes from "./meta-protocol/teiki.mp/types";
import { HeliosSource, newProgram } from "./program";
import { hlProjectDetailTypesSource } from "./project/project-detail.v/types";
import { hlProjectScriptTypesSource } from "./project/project-script.v/types";
import { hlProjectATTypesSource } from "./project/project.at/types";
import { hlProjectValidatorTypesSource } from "./project/project.v/types";
import { hlPParamsTypesSource } from "./protocol/protocol-params.v/types";
import { hlPProposalTypesSource } from "./protocol/protocol-proposal.v/types";
import { hlPNftTypesSource } from "./protocol/protocol.nft/types";
import { hlDedicatedTreasuryTypesSource } from "./treasury/dedicated-treasury.v/types";
import { hlOpenTreasuryTypesSource } from "./treasury/open-treasury.v/types";
import { hlSharedTreasuryTypesSource } from "./treasury/shared-treasury.v/types";

const SIMPLIFY = false; // Development

const COMMON_HELIOS_MODULES = [
  modConstants,
  modCommonTypes,
  modFraction,
  modHelpers,
  modTeikiMpTypes,
  modTeikiPlantNftTypes,
  modTeikiPlantVTypes,
  hlPParamsTypesSource,
  hlPProposalTypesSource,
  hlPNftTypesSource,
  hlProjectATTypesSource,
  hlProjectValidatorTypesSource,
  hlProjectDetailTypesSource,
  hlProjectScriptTypesSource,
  modBackingVTypes,
  modProofOfBackingMpTypes,
  hlDedicatedTreasuryTypesSource,
  hlOpenTreasuryTypesSource,
  hlSharedTreasuryTypesSource,
];

export default function compile(
  main: HeliosSource,
  parameters?: Record<string, Data>
) {
  return bytesToHex(toUplcProgram(main, parameters).toCbor());
}

export function toUplcProgram(
  main: HeliosSource,
  parameters?: Record<string, Data>
) {
  const program = newProgram(main, COMMON_HELIOS_MODULES);
  if (parameters)
    Object.entries(parameters).forEach(([name, value]) =>
      program.changeParam(name, toJson(value))
    );
  return program.compile(SIMPLIFY);
}
