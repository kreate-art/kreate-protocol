import getProtocolScriptV from "@/contracts/protocol/protocol-script.v/main";

import { compileAndLog } from "../base";

test("compile: V | Protocol Script", () => {
  const size = compileAndLog(getProtocolScriptV({ protocolNftMph: "" }));
  expect(size).toBeGreaterThan(0);
});
