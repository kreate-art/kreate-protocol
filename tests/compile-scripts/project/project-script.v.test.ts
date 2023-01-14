import getProjectScriptV from "@/contracts/project/project-script.v/main";

import { compileAndLog } from "../base";

test("compile: V | Project Script", () => {
  const size = compileAndLog(
    getProjectScriptV({
      projectAtMph: "",
      protocolNftMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});
