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
