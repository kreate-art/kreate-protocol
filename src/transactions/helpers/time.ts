import { UnixTime } from "lucid-cardano";

export type TimeProvider = () => UnixTime;

// This can be used with Lucid's upcoming Emulator
export function provideTimeOf(hasTime: { now(): UnixTime }): TimeProvider {
  return () => hasTime.now();
}

export const DEFAULT_TIME_PROVIDER = provideTimeOf(Date);
