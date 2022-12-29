import * as util from "node:util";

export function assert(
  condition: unknown,
  message?: string
): asserts condition {
  if (!condition) throw new Error(message || "assertion failed");
}

export function inspect(value: unknown, options?: util.InspectOptions): string {
  return util.inspect(value, { depth: null, colors: true, ...options });
}
