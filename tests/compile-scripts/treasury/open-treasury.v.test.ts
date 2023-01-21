import getOpenTreasuryV from "@/contracts/treasury/open-treasury.v/main";

import { compileAndLog } from "../base";

test("compile: V | Open Treasury", () => {
  const size = compileAndLog(getOpenTreasuryV({ protocolNftMph: "" }));
  expect(size).toBeGreaterThan(0);
});
