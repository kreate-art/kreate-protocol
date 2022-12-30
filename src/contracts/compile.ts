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
import { hlProjectATTypesSource } from "./project/ProjectAT/types";
import { hlProjectDetailTypesSource } from "./project/ProjectDetail/types";
import { hlProjectScriptTypesSource } from "./project/ProjectScript/types";
import { hlProjectValidatorTypesSource } from "./project/ProjectValidator/types";
import { hlPNftTypesSource } from "./protocol/Nfts/types";
import { hlPParamsTypesSource } from "./protocol/ParamsValidator/types";
import { hlPProposalTypesSource } from "./protocol/ProposalValidator/types";
import { hlDedicatedTreasuryTypesSource } from "./treasury/DedicatedTreasury/types";
import { hlOpenTreasuryTypesSource } from "./treasury/OpenTreasury/types";
import { hlSharedTreasuryTypesSource } from "./treasury/SharedTreasury/types";

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
  const program = newProgram(main, COMMON_HELIOS_MODULES);
  if (parameters)
    Object.entries(parameters).forEach(([name, value]) =>
      program.changeParam(name, toJson(value))
    );
  return bytesToHex(program.compile(SIMPLIFY).toCbor());
}
