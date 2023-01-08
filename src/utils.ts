export function assert(
  condition: unknown,
  message?: string
): asserts condition {
  if (!condition) throw new Error(message || "assertion failed");
}

export function nullIfFalsy<T>(item: T | null | undefined): T | null {
  return item ? item : null;
}
