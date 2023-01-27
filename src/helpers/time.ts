import { Emulator, Lucid } from "lucid-cardano";

import { UnixTime } from "@/types";

// TODO: Make sure all transactions accept a TimeProvider
export type TimeProvider = () => UnixTime;

export function getTime({
  timeProvider,
  lucid,
}: {
  timeProvider?: TimeProvider;
  lucid?: Lucid;
}): UnixTime {
  if (!timeProvider && lucid?.provider instanceof Emulator)
    return lucid.provider.now();
  else {
    // Truncate to the beginning of a second, due to how ouroboros works.
    const now = timeProvider ? timeProvider() : Date.now();
    return now - (now % 1000);
  }
}
