import getBackingV from "@/contracts/backing/backing.v/main";

import { compileAndLog } from "../base";

test("compile: V | Backing", () => {
  const size = compileAndLog(
    getBackingV({ proofOfBackingMph: "", protocolNftMph: "" })
  );
  expect(size).toBeGreaterThan(0);
});
