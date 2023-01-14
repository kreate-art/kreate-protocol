import { bytesToHex } from "@hyperionbt/helios";

import { compile } from "@/contracts/compile";
import { HeliosSource } from "@/contracts/program";

export function compileAndLog(script: HeliosSource) {
  const uplcProgram = compile(script);
  const size = uplcProgram.calcSize();
  console.log(`${size} | ${bytesToHex(uplcProgram.hash())}`);
  return size;
}

export const BLANK_OUT_REF = { txHash: "00".repeat(32), outputIndex: 0 };
