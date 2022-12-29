import { helios } from "../program";

export default helios`
  module fraction

  const FRACTION_LIMIT: Int = 4000000000

  struct Fraction {
    numerator: Int
    denominator: Int

    func multiply(self, other: Fraction) -> Fraction {
      temp: Fraction = Fraction
         { numerator: self.numerator * other.numerator
         , denominator: self.denominator * other.denominator
         };

      if (temp.numerator + temp.denominator <= FRACTION_LIMIT) {
        temp
      } else {
        Fraction
        { numerator: temp.numerator * FRACTION_LIMIT / (temp.numerator + temp.denominator)
        , denominator: temp.denominator * FRACTION_LIMIT / (temp.numerator + temp.denominator)
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
