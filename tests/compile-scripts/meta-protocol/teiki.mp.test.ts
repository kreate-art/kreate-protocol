import getTeikiMp from "@/contracts/meta-protocol/teiki.mp/main";

import { compileAndLog } from "../base";

test("compile: MP | Teiki", () => {
  const size = compileAndLog(getTeikiMp({ teikiPlantNftMph: "" }));
  expect(size).toBeGreaterThan(0);
});
