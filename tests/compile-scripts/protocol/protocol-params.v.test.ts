import getProtocolParamsV from "@/contracts/protocol/protocol-params.v/main";

import { compileAndLog } from "../base";

test("compile: V | Protocol Params", () => {
  const size = compileAndLog(getProtocolParamsV({ protocolNftMph: "" }));
  expect(size).toBeGreaterThan(0);
});
