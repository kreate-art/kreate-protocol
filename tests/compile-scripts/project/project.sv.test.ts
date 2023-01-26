import { bytesToHex } from "@hyperionbt/helios";

import { compile } from "@/contracts/compile";
import getProjectSv from "@/contracts/project/project.sv/main";

import { compileAndLog } from "../base";

test("compile: SV | Project", () => {
  const size = compileAndLog(
    getProjectSv({
      projectId: "",
      _stakingSeed: "",
      projectAtMph: "",
      protocolNftMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});

test("compile: SV | Project with the same _stakingSeed", () => {
  expect(
    compareScriptHashByStakingSeed({ seed1: "abc", seed2: "abc" })
  ).toBeTruthy();
});

test("compile: SV | Project with different _stakingSeed", () => {
  expect(
    compareScriptHashByStakingSeed({
      seed1: "abc",
      seed2: "def",
      simplify: true,
    })
  ).toBeFalsy();
});

type CompareScriptHashParams = {
  seed1: string;
  seed2: string;
  simplify?: boolean;
};

function compareScriptHashByStakingSeed({
  seed1,
  seed2,
  simplify = false,
}: CompareScriptHashParams) {
  const projectId = "";
  const projectAtMph = "";
  const protocolNftMph = "";

  const uplcProgram1 = compile(
    getProjectSv({
      projectId,
      _stakingSeed: seed1,
      projectAtMph,
      protocolNftMph,
    }),
    { simplify }
  );
  const scriptHash1 = bytesToHex(uplcProgram1.hash());

  const uplcProgram2 = compile(
    getProjectSv({
      projectId,
      _stakingSeed: seed2,
      projectAtMph,
      protocolNftMph,
    }),
    { simplify }
  );
  const scriptHash2 = bytesToHex(uplcProgram2.hash());

  return scriptHash1 === scriptHash2;
}
