import getSharedTreasuryV from "@/contracts/treasury/shared-treasury.v/main";

import { compileAndLog } from "../base";

test("compile: V | Shared Treasury", () => {
  const size = compileAndLog(
    getSharedTreasuryV({
      projectAtMph: "",
      protocolNftMph: "",
      teikiMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});
