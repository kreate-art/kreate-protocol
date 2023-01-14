import getProtocolNft from "@/contracts/protocol/protocol.nft/main";

import { BLANK_OUT_REF, compileAndLog } from "../base";

test("compile: NFT | Protocol", () => {
  const size = compileAndLog(getProtocolNft({ protocolSeed: BLANK_OUT_REF }));
  expect(size).toBeGreaterThan(0);
});
