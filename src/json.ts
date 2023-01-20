// TODO: A duplication of teiki-web/modules/json-utils/index.ts
import JsonBigFactory from "@shinka-network/json-bigint";

const JsonBig = JsonBigFactory({ useNativeBigInt: true });

export default JsonBig;

export type Json<_> = string;

/**
 * Converts a JSON-formatted string to a JS value.
 *
 * Big integers will be parsed as `bigint` values.
 * This function is the bigint-aware alternative of `JSON.parse`.
 */
export function fromJson<T = unknown>(
  text: Json<T>,
  options?: { forceBigInt?: boolean }
): T {
  return options?.forceBigInt
    ? JsonBig.parse(text, (_, value) =>
        Number.isInteger(value) ? BigInt(value) : value
      )
    : JsonBig.parse(text);
}

/**
 * Converts a JS value to a JSON-formatted string.
 *
 * Values of `bigint` will be stringified properly.
 * This function is the bigint-aware alternative of `JSON.stringify`.
 */
export function toJson<T = unknown>(value: T, space?: number): Json<T> {
  return JsonBig.stringify(value, null, space);
}
