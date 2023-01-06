// This is a mirror of `src/contracts/common/fraction.ts`

import { FRACTION_LIMIT } from "./constants";

export type Fraction = {
  numerator: bigint;
  denominator: bigint;
};

export function multiplyFraction(f1: Fraction, f2: Fraction): Fraction {
  const temp: Fraction = {
    numerator: f1.numerator * f2.numerator,
    denominator: f1.denominator * f2.denominator,
  };

  if (temp.numerator + temp.denominator <= FRACTION_LIMIT) {
    return temp;
  } else {
    return {
      numerator:
        (temp.numerator * FRACTION_LIMIT) / (temp.numerator + temp.denominator),
      denominator:
        (temp.denominator * FRACTION_LIMIT) /
        (temp.numerator + temp.denominator),
    };
  }
}

export function exponentialFraction(f: Fraction, exponent: number): Fraction {
  if (exponent === 0) {
    return { numerator: 1n, denominator: 1n };
  } else if (exponent === 1) {
    return f;
  } else if (exponent % 2 === 0) {
    const half: Fraction = exponentialFraction(f, exponent / 2);
    return multiplyFraction(half, half);
  } else {
    const half: Fraction = exponentialFraction(f, Math.floor(exponent / 2));
    return multiplyFraction(f, multiplyFraction(half, half));
  }
}
