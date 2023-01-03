import * as helios from "@hyperionbt/helios";

import * as S from "@/schema";
import { OutRef, Hex } from "@/types";

describe("complex schema", () => {
  const OneStruct = S.Struct(S.Inline(S.ByteArray));
  const MiniStruct = S.Struct({
    b: S.Int,
    c: S.String,
  });
  const InlinedEnum = S.Enum("type", {
    Old: S.Inline(MiniStruct),
    New: S.Void,
  });

  const Datum = S.Enum("direction", {
    Up: S.Void,
    Down: S.Void,
    Left: {
      foo: OneStruct,
      bar: S.Option(MiniStruct),
      baz: S.TxOutputId,
      inl: InlinedEnum,
    },
    Right: S.Void,
  });
  type Datum = S.Static<typeof Datum>;

  type Params = { a: Hex; b: number; c: string; d: OutRef };

  function buildHeliosScript({ a, b, c, d }: Params) {
    return `
    testing schema

    struct OneStruct {
      a: ByteArray
    }

    struct MiniStruct {
      b: Int
      c: String
    }

    enum InlinedEnum {
      Old { inline: MiniStruct }
      New
    }

    enum Datum {
      Left
      Down
      Up {
        foo: OneStruct
        bar: Option[MiniStruct]
        baz: TxOutputId
      }
      Right
    }

    func main(datum: Datum) -> Bool {
      datum.switch {
        i: Up => {
          i.foo.a == #${a}
            && i.bar.unwrap().b == ${b.toString()}
            && i.bar.unwrap().c == "${c}"
            && i.baz.tx_id.show() == "${d.txHash}"
            && i.baz.index == ${d.outputIndex.toString()}
        },
        else => { false }
      }
    }
  `;
  }

  function buildDatum({ a, b, c, d }: Params): Datum {
    return {
      direction: "Left",
      foo: a,
      bar: { b: BigInt(b), c },
      baz: {
        txId: d.txHash,
        index: BigInt(d.outputIndex),
      },
      inl: { type: "Old", b: BigInt(b), c },
    };
  }

  const sampleParams: Params = {
    a: "beef1234",
    b: 42,
    c: "Hello World",
    d: {
      txHash:
        "e1ffe6d8e94556ce6f24e53d94dc5d9559c2cbc8f00dad3737c61cd0d60a91dc",
      outputIndex: 10,
    },
  };

  const datum: Datum = buildDatum(sampleParams);

  it("round trip", () => {
    const sampleCbor =
      "d87b9f44beef1234d8799f9f182a4b48656c6c6f20576f726c64ffffd8799fd8799f5820e1ffe6d8e94556ce6f24e53d94dc5d9559c2cbc8f00dad3737c61cd0d60a91dcff0affd8799f9f182a4b48656c6c6f20576f726c64ffffff";
    const cbor = S.toCbor(S.toData(datum, Datum));
    expect(cbor).toBe(sampleCbor);

    const deserialized = S.fromData(S.fromCbor(cbor), Datum);
    expect(deserialized).toStrictEqual(datum);
  });

  it("helios compatibility", async () => {
    expect.assertions(2);
    const cbor = S.toCbor(S.toData(datum, Datum));
    const heliosScript = buildHeliosScript(sampleParams);
    const uplcProgram = helios.Program.new(heliosScript).compile(true);
    const dummy = helios.exportedForTesting.Site.dummy();
    const [result, _] = await uplcProgram.runWithPrint([
      new helios.UplcDataValue(
        dummy,
        helios.UplcData.fromCbor(helios.hexToBytes(cbor))
      ),
    ]);
    expect(result).toBeInstanceOf(helios.UplcBool);
    expect((result as helios.UplcBool).bool).toBe(true);
  });
});
