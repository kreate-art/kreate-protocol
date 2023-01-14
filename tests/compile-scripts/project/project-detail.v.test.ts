import getProjectDetailV from "@/contracts/project/project-detail.v/main";

import { compileAndLog } from "../base";

test("compile: V | Project Detail", () => {
  const size = compileAndLog(
    getProjectDetailV({
      projectAtMph: "",
      protocolNftMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});
