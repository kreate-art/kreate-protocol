import getProofOfBackingMp from "@/contracts/backing/proof-of-backing.mp/main";

import { compileAndLog } from "../base";

test("compile: MP | Proof of Backing", () => {
  const size = compileAndLog(
    getProofOfBackingMp({
      projectsAuthTokenMph: "",
      protocolNftMph: "",
      teikiMph: "",
    })
  );
  expect(size).toBeGreaterThan(0);
});
