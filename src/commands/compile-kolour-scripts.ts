import { UplcProgram } from "@hyperionbt/helios";

import { compile } from "@/contracts/compile";
import getKolourNft, {
  Params as KolourNftParams,
} from "@/contracts/kolours/kolour.nft/main";

export function compileKolourNftScript(params: KolourNftParams): UplcProgram {
  return compile(getKolourNft(params));
}
