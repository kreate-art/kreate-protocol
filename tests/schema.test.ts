import * as helios from "@hyperionbt/helios";
import { fromHex } from "lucid-cardano";

import * as S from "@/schema";
import { OutRef, Hex, CborHex } from "@/types";

describe("complex schema", () => {
  const OneStruct = S.Struct({
    a: S.ByteArray,
  });
  const MiniStruct = S.Struct({
    b: S.Int,
    c: S.String,
  });
  const Datum = S.Enum("direction", {
    Up: {},
    Down: {},
    Left: {
      foo: OneStruct,
      bar: S.Option(MiniStruct),
      baz: S.TxOutputId,
    },
    Right: {},
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
      foo: { a: fromHex(a) },
      bar: { b: BigInt(b), c },
      baz: {
        txId: { $txId: fromHex(d.txHash) },
        index: BigInt(d.outputIndex),
      },
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

  test("round trip", () => {
    const sampleCbor: CborHex =
      "d87b9f44beef1234d8799f9f182a4b48656c6c6f20576f726c64ffffd8799fd8799f5820e1ffe6d8e94556ce6f24e53d94dc5d9559c2cbc8f00dad3737c61cd0d60a91dcff0affff";
    const cbor = S.toCbor(S.toData(datum, Datum));
    expect(cbor).toBe(sampleCbor);

    const deserialized = S.fromData(S.fromCbor(cbor), Datum);
    expect(deserialized).toStrictEqual(datum);
  });

  test("compatible with helios", async () => {
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
