import getProjectAt from "@/contracts/project/project.at/main";

import { compileAndLog } from "../base";

test("compile: AT | Project", () => {
  const size = compileAndLog(getProjectAt({ protocolNftMph: "" }));
  expect(size).toBeGreaterThan(0);
});
