import {
  Hint,
  Kind,
  NumericOptions,
  PropertiesReduce,
  TArray,
  TBoolean,
  TLiteral,
  TNever,
  TProperties,
  TSchema,
  Type,
  type Static,
} from "@sinclair/typebox";
import { Custom } from "@sinclair/typebox/custom";
import { Data } from "lucid-cardano";

import { isData } from "@/types";
import { assert } from "@/utils";

// Re-exports
export { type Static, type TProperties };

// Inlining
export const Inline: unique symbol = Symbol.for("Inline");
export type TInline = { [Inline]: TSchema };
export type TPropertiesPlus = TProperties | TInline;

// Custom typebox
Custom.Set("Int", (_, value) => typeof value === "bigint");
Custom.Set("Data", (_, value) => isData(value));
Custom.Set("Map", (_, value) => value instanceof Map);
Custom.Set("Option", () => true);

// TODO: Restrict to TUplc instead of TSchema
export type TUplc =
  | TInt
  | TBool
  | TByteArray
  | TString
  | TRawData
  | TOption
  | TList
  | TMap
  | TStruct
  | TEnum;

// Primitives
export interface TInt extends TSchema, NumericOptions {
  [Kind]: "Int";
  static: bigint;
  type: "bigint";
}
export const Int: TInt = {
  ...Type.Unsafe({}),
  [Kind]: "Int",
  type: "bigint",
};

export type TBool = TBoolean;
export const Bool = Type.Boolean();

// Since Hex is just a type alias for string, it's not worth creating a new TSchema
export type TByteArray = typeof ByteArray;
export const ByteArray = Type.String({ format: "hex" });

export type TString = typeof String;
export const String = Type.String({ format: "text" });

// Raw Data
export type RawData = { data: Data };
export interface TRawData extends TSchema {
  [Kind]: "Data";
  static: RawData;
}
export const TRawData: TRawData = { ...Type.Unsafe({}), [Kind]: "Data" };

// Basic Structures
export interface TOption<T extends TSchema = TSchema> extends TSchema {
  [Kind]: "Option";
  static: Static<T> | null;
  value: T;
  type: "option";
}
export function Option<T extends TSchema>(schema: T): TOption<T> {
  return {
    ...Type.Unsafe({}),
    [Kind]: "Option",
    value: schema,
    type: "option",
  };
}

export type TList<T extends TSchema = TSchema> = TArray<T>;
export function List<T extends TSchema>(schema: T): TArray<T> {
  return Type.Array(schema);
}

export interface TMap<K extends TSchema = TSchema, V extends TSchema = TSchema>
  extends TSchema {
  [Kind]: "Map";
  static: Map<Static<K>, Static<V>>;
  key: K;
  value: V;
  type: "map";
}
export function Map<K extends TSchema, V extends TSchema>(
  keySchema: K,
  valueSchema: V
): TMap<K, V> {
  return {
    ...Type.Unsafe({}),
    [Kind]: "Map",
    key: keySchema,
    value: valueSchema,
    type: "map",
  };
}

// Constructs
export interface TStruct<T extends TPropertiesPlus = TPropertiesPlus>
  extends TSchema {
  [Kind]: "Object";
  static: T extends TInline
    ? Static<T[typeof Inline]>
    : PropertiesReduce<T, this["params"]>;
  properties: T;
  type: "struct";
  // Helios structs are encoded using data-lists.
  // Other language's structs are encoded using constrs.
  constr: boolean;
}
export function Struct<T extends TPropertiesPlus>(
  properties: T,
  constr = false
): TStruct<T> {
  if (Inline in properties) {
    // TODO: Enforce this at type-level
    assert(
      !Object.keys(properties).length,
      "inlined struct must not have any other property"
    );
  }
  return {
    ...Type.Unsafe(),
    [Kind]: "Object",
    type: "struct",
    constr,
    properties,
  };
}
export function ConStruct<T extends TPropertiesPlus>(
  properties: T
): TStruct<T> {
  return Struct(properties, true);
}

const Never: unique symbol = Symbol.for("Never");
type Never = typeof Never;
type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;
type AggNever<T> = keyof T extends never
  ? unknown
  : Never extends T[keyof T]
  ? never
  : T[keyof T];

export interface TEnum<
  D extends string = string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  T extends Record<string, TPropertiesPlus> = {}
> extends TSchema {
  [Kind]: "Union";
  static: AggNever<{
    [K in keyof T]: K extends string
      ? T[K] extends TInline
        ? T[K][typeof Inline][typeof Kind] extends "Object" | "Union"
          ? Simplify<{ [L in D]: K } & Static<T[K][typeof Inline]>>
          : Never
        : PropertiesReduce<{ [L in D]: TLiteral<K> } & T[K], this["params"]>
      : Never;
  }>;
  discriminator: D;
  variants: T;
  type: "enum";
}

export function Enum<D extends string>(
  _: D,
  variants: Record<string, never>
): TNever;
export function Enum<
  D extends string,
  T extends Record<string, TPropertiesPlus>
>(discriminator: D, variants: T): TEnum<D, T>;
export function Enum<
  D extends string,
  T extends Record<string, TPropertiesPlus>
>(discriminator: D, variants: T): TNever | TEnum<D, T> {
  if (variants) {
    for (const variant of Object.values(variants)) {
      if (Inline in variant) {
        assert(
          !Object.keys(variant).length,
          "inlined enum variant must not have any other property"
        );
        const kind = variant[Inline][Kind];
        assert(
          kind === "Object" || kind === "Union",
          "inlined enum variant must points to Struct or Enum"
        );
      }
    }
    return {
      ...Type.Unsafe({}),
      [Kind]: "Union",
      discriminator,
      variants,
      type: "enum",
    };
  } else return Type.Never();
}

// Tagging
export type TAnnotated<A extends string, T extends TSchema = TSchema> = {
  [Hint]: A;
} & T;

export function Annotated<A extends string, T extends TSchema>(
  annotation: A,
  schema: T
): TAnnotated<A, T> {
  return { ...schema, [Hint]: annotation };
}
