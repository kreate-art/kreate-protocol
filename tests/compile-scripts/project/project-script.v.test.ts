import getProjectScriptV from "@/contracts/project/project-script.v/main";

import { compileAndLog } from "../base";

test("compile: V | Project Script", () => {
  const size = compileAndLog(
    getProjectScriptV({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});
