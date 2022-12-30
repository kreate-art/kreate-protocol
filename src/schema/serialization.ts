// Heavily influenced by https://github.com/spacebudz/lucid/blob/main/src/plutus/data.ts
import { Kind, TProperties } from "@sinclair/typebox";
import { Constr, Data, fromHex, toText, toHex, fromText } from "lucid-cardano";

import { CborHex } from "@/types";
import { assert } from "@/utils";

import { TEnum, TUplc } from "./uplc";

export function toCbor(data: Data): CborHex {
  return Data.to(data);
}

export function fromCbor(raw: CborHex): Data {
  return Data.from(raw);
}

export const toJson = Data.toJson;
export const fromJson = Data.fromJson;

export function toData<T>(self: T, schema: TUplc): Data {
  switch (schema[Kind]) {
    case "BigInt":
      assert(typeof self === "bigint", "self must be bigint");
      return self;
    case "Boolean":
      assert(typeof self === "boolean", "self must be boolean");
      return new Constr(self ? 1 : 0, []);
    case "String":
      assert(typeof self === "string", "self must be string");
      return fromText(self); // TODO: Weird as hell...
    case "Uint8Array":
      assert(self instanceof Uint8Array, "self must be Uint8Array");
      return toHex(self); // TODO: Unneeded conversion...
    case "Data":
      assert(typeof self === "object" && self != null, "self must be object");
      assert("data" in self, "self must have field data");
      return self.data as Data;
    case "Option":
      return self != null
        ? new Constr(0, [toData(self, schema.value as TUplc)])
        : new Constr(1, []);
    case "Array":
      assert(self instanceof Array, "self must be Array");
      return self.map((item) => toData(item, schema.items as TUplc));
    case "Map": {
      assert(self instanceof Map, "self must be Map");
      const entries: [Data, Data][] = [];
      const keySchema = schema.key as TUplc;
      const valueSchema = schema.value as TUplc;
      for (const [key, value] of self.entries())
        entries.push([toData(key, keySchema), toData(value, valueSchema)]);
      return new Map(entries);
    }
    case "Object": {
      // assert(schema.type === "struct", "expect Struct or ConStruct schema");
      assert(typeof self === "object" && self != null, "self must be object");
      const datas = toDataUsingProperties(
        self as Record<string, unknown>,
        schema.properties
      );
      if (schema.constr) return new Constr(0, datas);
      // Helios has special encoding for 1-field structs (newtypes)
      else if (datas.length === 1) return datas[0];
      else return datas;
    }
    case "Union": {
      // assert(schema.type === "enum", "expect Enum schema");
      assert(typeof self === "object" && self != null, "self must be object");
      const record = self as Record<string, unknown>;
      const variantName = record[schema.discriminator] as string;
      assert(variantName, "no enum variant specified");
      const result = selectVariant(schema, (index, name, properties) =>
        name === variantName
          ? new Constr(index, toDataUsingProperties(record, properties))
          : undefined
      );
      assert(result !== undefined, `invalid enum variant: ${variantName}`);
      return result;
    }
  }
}

export function fromData<T>(data: Data, schema: TUplc): T {
  switch (schema[Kind]) {
    case "BigInt":
      assert(typeof data === "bigint", "data must be bigint");
      return data as T;
    case "Boolean":
      assert(data instanceof Constr, "data must be Constr (for boolean)");
      assert(
        !data.fields.length,
        "data (Constr) fields must be empty for boolean"
      );
      if (data.index === 0) return false as T;
      else if (data.index === 1) return true as T;
      else throw new Error(`invalid Constr index for boolean: ${data.index}`);
    case "String":
      assert(typeof data === "string", "data must be string (for string)");
      return toText(data) as T; // TODO: Weird as hell...
    case "Uint8Array":
      assert(typeof data === "string", "data must be string (for UInt8Array)");
      return fromHex(data) as T; // TODO: Unneeded conversion...
    case "Data":
      return { data } as T;
    case "Option":
      assert(data instanceof Constr, "data must be Constr (for Option)");
      if (data.index === 0) {
        assert(
          data.fields.length === 1,
          "data (Constr) fields must have exactly 1 element for Option::Some"
        );
        return fromData(data.fields[0], schema.value as TUplc);
      } else if (data.index === 1) {
        assert(
          !data.fields.length,
          "data (Constr) fields must be empty for Option::None"
        );
        return null as T;
      } else throw new Error(`invalid Constr index for Option: ${data.index}`);
    case "Array":
      assert(data instanceof Array, "data must be Array");
      return data.map((item) => fromData(item, schema.items as TUplc)) as T;
    case "Map": {
      assert(data instanceof Map, "data must be Map");
      const entries: [unknown, unknown][] = [];
      const keySchema = schema.key as TUplc;
      const valueSchema = schema.value as TUplc;
      for (const [key, value] of data.entries())
        entries.push([fromData(key, keySchema), fromData(value, valueSchema)]);
      return new Map(entries) as T;
    }
    case "Object": {
      // assert(schema.type === "struct", "expect Struct or ConStruct schema");
      let datas: Data[];
      if (schema.constr) {
        assert(
          data instanceof Constr && data.index === 0,
          "data must be Constr with index 0"
        );
        datas = data.fields;
      } else {
        if (Object.keys(schema.properties).length === 1) {
          // Helios has special encoding for 1-field structs (newtypes)
          datas = [data];
        } else {
          assert(data instanceof Array, "data must be Array");
          datas = data;
        }
      }
      return fromDataUsingProperties(datas, schema.properties) as T;
    }
    case "Union": {
      // assert(schema.type === "enum", "expect Enum schema");
      assert(data instanceof Constr, "data must be Constr");
      const result = selectVariant(schema, (index, name, properties) =>
        index === data.index
          ? ({
              [schema.discriminator]: name,
              ...fromDataUsingProperties(data.fields, properties),
            } as T)
          : undefined
      );
      assert(result !== undefined, `enum variant out of bound: ${data.index}`);
      return result;
    }
  }
}

function selectVariant<
  D extends string,
  T extends Record<string, TProperties>,
  R
>(
  schema: TEnum<D, T>,
  callback: (
    index: number,
    name: string,
    properties: TProperties
  ) => R | undefined
): R | undefined {
  for (const [index, [name, properties]] of Object.entries(
    schema.variants
  ).entries()) {
    const result = callback(index, name, properties);
    if (result !== undefined) return result;
  }
  return undefined;
}

function toDataUsingProperties<P extends TProperties>(
  record: Record<string, unknown>,
  properties: P
): Data[] {
  return Object.entries(properties).map(([field, fieldSchema]) =>
    toData(record[field], fieldSchema as TUplc)
  );
}

function fromDataUsingProperties<P extends TProperties>(
  datas: Data[],
  properties: P
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).map(([field, fieldSchema], index) => [
      field,
      fromData(datas[index], fieldSchema as TUplc),
    ])
  );
}
