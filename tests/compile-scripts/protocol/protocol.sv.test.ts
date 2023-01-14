import getProtocolSv from "@/contracts/protocol/protocol.sv/main";

import { compileAndLog } from "../base";

test("compile: SV | Protocol", () => {
  const size = compileAndLog(getProtocolSv(""));
  expect(size).toBeGreaterThan(0);
});
