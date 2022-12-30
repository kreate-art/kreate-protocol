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
  TString,
  TUint8Array,
  Type,
  type Static,
} from "@sinclair/typebox";
import { Custom } from "@sinclair/typebox/custom";
import { Data } from "lucid-cardano";

// Re-exports
export { type Static };

// Custom typebox
Custom.Set("BigInt", (_, value) => typeof value === "bigint");
Custom.Set("Map", (_, value) => value instanceof Map);
Custom.Set("Option", () => true);

// TODO: Restrict to TUplc instead of TSchema
export type TUplc =
  | TInt
  | TBoolean
  | TString
  | TUint8Array
  | TRawData
  | TOption
  | TList
  | TMap
  | TStruct
  | TEnum;

// Primitives
export interface TInt extends TSchema, NumericOptions {
  [Kind]: "BigInt";
  static: bigint;
  type: "bigint";
}
export const Int: TInt = {
  ...Type.Unsafe({}),
  [Kind]: "BigInt",
  type: "bigint",
};
export const Bool = Type.Boolean();
export const String = Type.String();
export const ByteArray = Type.Uint8Array();

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
export interface TStruct<T extends TProperties = TProperties> extends TSchema {
  [Kind]: "Object";
  static: PropertiesReduce<T, this["params"]>;
  properties: T;
  type: "struct";
  // Helios structs are encoded using data-lists.
  // Other language's structs are encoded using constrs.
  constr: boolean;
}
export function Struct<T extends TProperties>(properties: T): TStruct<T> {
  return { ...Type.Object(properties), type: "struct", constr: false };
}
export function ConStruct<T extends TProperties>(properties: T): TStruct<T> {
  return { ...Type.Object(properties), type: "struct", constr: true };
}

type ValueOf<T> = keyof T extends never ? unknown : T[keyof T];

export interface TEnum<
  D extends string = string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  T extends Record<string, TProperties> = {}
> extends TSchema {
  [Kind]: "Union";
  static: ValueOf<{
    [K in keyof T]: K extends string
      ? PropertiesReduce<{ [L in D]: TLiteral<K> } & T[K], this["params"]>
      : never;
  }>;
  discriminator: D;
  variants: T;
  type: "enum";
}

export function Enum<D extends string>(
  _: D,
  variants: Record<string, never>
): TNever;
export function Enum<D extends string, T extends Record<string, TProperties>>(
  discriminator: D,
  variants: T
): TEnum<D, T>;
export function Enum<D extends string, T extends Record<string, TProperties>>(
  discriminator: D,
  variants: T
): TNever | TEnum<D, T> {
  if (variants)
    return {
      ...Type.Unsafe({}),
      [Kind]: "Union",
      discriminator,
      variants,
      type: "enum",
    };
  else return Type.Never();
}

// Tagging
export type TTagged<A extends string, T extends TSchema = TSchema> = {
  [Hint]: A;
} & T;

export function Annotated<A extends string, T extends TSchema>(
  annotation: A,
  schema: T
): TTagged<A, T> {
  return { ...schema, [Hint]: annotation };
}
