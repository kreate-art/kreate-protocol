import getProjectV from "@/contracts/project/project.v/main";

import { compileAndLog } from "../base";

test("compile: V | Project", () => {
  const size = compileAndLog(
    getProjectV({
      projectAtMph: "",
      protocolNftMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});
