import { RATIO_MULTIPLIER } from "../constants";
import { Fraction, exponentialFraction } from "../fraction";

// This is a mirror of `calculate_teiki_remaining` in src/contracts/common/helpers.ts
export function calculateTeikiRemaining(
  available: bigint,
  burnRateInv: bigint,
  epochs: number
): bigint {
  const r: Fraction = exponentialFraction(
    { numerator: burnRateInv, denominator: RATIO_MULTIPLIER },
    epochs
  );

  return ((r.denominator - r.numerator) * available) / r.denominator;
}
