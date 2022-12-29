import { bytesToHex } from "@hyperionbt/helios";
import { Data } from "lucid-cardano";

import { toJson } from "@/schema";

import { hlBackingValidatorTypesSource } from "./backing/BackingValidator/types";
import { hlProofOfBackingTypesSource } from "./backing/ProofOfBacking/types";
import modFraction from "./common/fraction";
import modHelpers from "./common/helpers";
import modCommonTypes from "./common/types";
import { modConstants } from "./constants";
import modMpTeikiTypes from "./meta-protocol/mp.teiki/types";
import modNftTeikiPlantTypes from "./meta-protocol/nft.teiki-plant/types";
import modVTeikiPlantTypes from "./meta-protocol/v.teiki-plant/types";
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
  modMpTeikiTypes,
  modNftTeikiPlantTypes,
  modVTeikiPlantTypes,
  hlPParamsTypesSource,
  hlPProposalTypesSource,
  hlPNftTypesSource,
  hlProjectATTypesSource,
  hlProjectValidatorTypesSource,
  hlProjectDetailTypesSource,
  hlProjectScriptTypesSource,
  hlBackingValidatorTypesSource,
  hlProofOfBackingTypesSource,
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
