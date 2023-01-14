import getDedicatedTreasuryV from "@/contracts/treasury/dedicated-treasury.v/main";

import { compileAndLog } from "../base";

test("compile: V | Dedicated Treasury", () => {
  const size = compileAndLog(
    getDedicatedTreasuryV({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});
