import { bytesToHex } from "@hyperionbt/helios";

import { compile } from "@/contracts/compile";
import getProjectSv from "@/contracts/project/project.sv/main";

import { compileAndLog } from "../base";

test("compile: SV | Project", () => {
  const size = compileAndLog(
    getProjectSv({
      projectId: "",
      stakingSeed: "",
      projectAtMph: "",
      protocolNftMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});

test("compile: SV | Project with different stakingSeed", () => {
  function compareStakingCredential(
    seed1: string,
    seed2: string,
    simplify = true
  ) {
    const projectId = "";
    const projectAtMph = "";
    const protocolNftMph = "";
    function _compile(seed: string) {
      const uplcProgram = compile(
        getProjectSv({
          projectId,
          stakingSeed: seed,
          projectAtMph,
          protocolNftMph,
        }),
        { simplify }
      );
      return bytesToHex(uplcProgram.hash());
    }
    return _compile(seed1) === _compile(seed2);
  }
  expect(compareStakingCredential("abc", "abc")).toBeTruthy();
  expect(compareStakingCredential("abc", "def")).toBeFalsy();
});
