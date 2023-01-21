import getProtocolProposalV from "@/contracts/protocol/protocol-proposal.v/main";

import { compileAndLog } from "../base";

test("compile: V | Protocol Proposal", () => {
  const size = compileAndLog(getProtocolProposalV({ protocolNftMph: "" }));
  expect(size).toBeGreaterThan(0);
});
