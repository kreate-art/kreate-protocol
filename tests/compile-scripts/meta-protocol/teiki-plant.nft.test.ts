import getTeikiPlantNft from "@/contracts/meta-protocol/teiki-plant.nft/main";

import { BLANK_OUT_REF, compileAndLog } from "../base";

test("compile: NFT | Teiki Plant", () => {
  const size = compileAndLog(
    getTeikiPlantNft({ teikiPlantSeed: BLANK_OUT_REF })
  );
  expect(size).toBeGreaterThan(0);
});
