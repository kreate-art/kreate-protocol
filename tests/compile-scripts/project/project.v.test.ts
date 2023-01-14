import getProjectV from "@/contracts/project/project.v/main";

import { compileAndLog } from "../base";

test("compile: V | Project", () => {
  const size = compileAndLog(
    getProjectV({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});
