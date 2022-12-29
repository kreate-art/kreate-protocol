import * as helios from "@hyperionbt/helios";

import * as S from "@/schema";
import { assert, inspect } from "@/utils";

const OneStruct = S.Struct({
  c: S.ByteArray,
});
const MiniStruct = S.Struct({
  a: S.Int,
  b: S.String,
});
const Datum = S.Enum("direction", {
  Left: {},
  Down: {},
  Up: { foo: OneStruct, bar: S.Option(MiniStruct) },
  Right: {},
});
type Datum = S.Static<typeof Datum>;

const datum: Datum = {
  direction: "Up",
  foo: { c: new Uint8Array([1, 2, 3, 4]) },
  bar: { a: 123n, b: "hello world" },
};
console.log(inspect(datum));

const inData = S.toData(datum, Datum);
console.log(inspect(inData));

console.log("--------------------------------");
const cbor = S.toCbor(inData);
console.log(cbor);
assert(cbor === "d87b9f4401020304d8799f9f187b4b68656c6c6f20776f726c64ffffff");
console.log("--------------------------------");

const outData = S.fromCbor(cbor);
console.log(inspect(outData));
console.log(inspect(S.fromData(outData, Datum)));

console.log("--------------------------------");

const heliosScript = `
spending foo

struct OneStruct {
  c: ByteArray
}

struct MiniStruct {
  a: Int
  b: String
}

enum Datum {
  Left
  Down
  Up {
    foo: OneStruct
    bar: Option[MiniStruct]
  }
  Right
}

func main(datum: Datum) -> Bool {
  datum.switch {
    i: Up => { print(i.bar.unwrap().b); i.foo.c == #01020304 && i.bar.unwrap().a == 123 },
    else => { false }
  }
}
`;

const uplcProgram = helios.Program.new(heliosScript).compile();
const dummy = helios.exportedForTesting.Site.dummy();
const empty = new helios.UplcUnit(dummy);
const [result, messages] = await uplcProgram.runWithPrint([
  new helios.UplcDataValue(
    dummy,
    helios.UplcData.fromCbor(helios.hexToBytes(cbor))
  ),
  empty,
  empty,
]);
console.log(result, messages);
