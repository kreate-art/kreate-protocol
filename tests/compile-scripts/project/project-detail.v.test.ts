import getProjectDetailV from "@/contracts/project/project-detail.v/main";

import { compileAndLog } from "../base";

test("compile: V | Project Detail", () => {
  const size = compileAndLog(
    getProjectDetailV({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});
