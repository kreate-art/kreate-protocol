// Synchronize with the fraction in transactions
import { FRACTION_LIMIT } from "@/transactions/constants";

import { header, helios } from "../program";

export default helios`
  ${header("module", "fraction")}

  const FRACTION_LIMIT: Int = ${FRACTION_LIMIT}

  struct Fraction {
    numerator: Int
    denominator: Int

    func multiply(self, other: Fraction) -> Fraction {
      t_numerator: Int = self.numerator * other.numerator;
      t_denominator: Int = self.denominator * other.denominator;
      t_sum: Int = t_numerator + t_denominator;

      if (t_sum > FRACTION_LIMIT) {
        Fraction {
          numerator: t_numerator * FRACTION_LIMIT / t_sum,
          denominator: t_denominator * FRACTION_LIMIT / t_sum
        }
      } else {
        Fraction {
          numerator: t_numerator,
          denominator: t_denominator
        }
      }
    }

    func exponential(self, exponent: Int) -> Fraction {
      if (exponent == 0) {
        Fraction { numerator: 1, denominator: 1}
      } else if (exponent == 1) {
        self
      } else if (exponent % 2 == 0) {
        half: Fraction = self.exponential(exponent / 2);
        half.multiply(half)
      } else {
        half: Fraction = self.exponential(exponent / 2);
        half.multiply(half).multiply(self)
      }
    }
  }
`;
