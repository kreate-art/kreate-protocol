import getKolourNft from "@/contracts/kolours/kolour.nft/main";

import { compileAndLog } from "../base";

test("compile: NFT | Kolour", () => {
  const size = compileAndLog(getKolourNft({ producerPkh: "" }));
  expect(size).toBeGreaterThan(0);
});
