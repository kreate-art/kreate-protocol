// Note that the `string` case of Lucid `Data` is in hex form.
import { Constr, type Data, type OutRef } from "lucid-cardano";

export { type Data, type OutRef };

export type Actor =
  | "protocol-governor"
  | "staking-manager"
  | "project-owner"
  | "anyone";

export type Hex = string;
export type Cid = string;

export type UnixTime = number;
export type TimeDifference = number;

export type LovelaceAmount = number | bigint;

// Guards
export function isHex(value: unknown): value is Hex {
  return typeof value === "string" && /^[0-9A-Fa-f]*$/.test(value);
}

export function isData(value: unknown): value is Data {
  return (
    typeof value === "bigint" ||
    isHex(value) ||
    (value instanceof Array && value.every(isData)) ||
    (value instanceof Map &&
      Array.from(value.entries()).every(([k, v]) => isData(k) && isData(v))) ||
    value instanceof Constr
  );
}

export function isEmpty(value: unknown): value is Record<never, never> {
  return (
    typeof value === "object" && value !== null && !Object.keys(value).length
  );
}
