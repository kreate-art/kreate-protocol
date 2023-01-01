import { Emulator, Lucid } from "lucid-cardano";

import { UnixTime } from "@/types";

export function getCurrentTime(lucid: Lucid): UnixTime {
  return lucid.provider instanceof Emulator ? lucid.provider.now() : Date.now();
}
