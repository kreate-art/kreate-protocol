import {
  Kind,
  PropertiesReduce,
  TArray,
  TLiteral,
  TNever,
  TProperties,
  TSchema,
  TVoid,
  Type,
  TypeRegistry,
  type Static,
} from "@sinclair/typebox";
import { Data } from "lucid-cardano";

import { isData, isEmpty } from "@/types";

// TODO: Rewrite this to match typebox best practices

// Re-exports
export { type Static, type TProperties, type TVoid };

// Type utilities
type Simplify<T> = T extends object ? { [K in keyof T]: T[K] } : T;

// Custom typebox
TypeRegistry.Set("Int", (_, value) => typeof value === "bigint");
TypeRegistry.Set("Data", (_, value) => isData(value));
// TODO: Stricter check
TypeRegistry.Set("Map", (_, value) => Array.isArray(value));
TypeRegistry.Set("Option", () => true);

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
export interface TInt extends TSchema {
  $id: "Int";
  [Kind]: "Int";
  static: bigint;
  type: "bigint";
}
export const Int: TInt = {
  ...Type.BigInt(),
  $id: "Int",
  [Kind]: "Int",
  type: "bigint",
};

export type TBool = typeof Bool;
export const Bool = Type.Boolean({ $id: "Bool" });

// Since Hex is just a type alias for string, it's not worth creating a new TSchema
export type TByteArray = typeof ByteArray;
export const ByteArray = Type.String({ $id: "ByteArray", format: "hex" });

export type TString = typeof String;
export const String = Type.String({ $id: "String", format: "text" });

// Raw Data
export type IRawData = { data: Data };
export interface TRawData extends TSchema {
  $id: "Data";
  [Kind]: "Data";
  static: IRawData;
}
export const TRawData: TRawData = {
  ...Type.Unsafe(),
  [Kind]: "Data",
  $id: "Data",
};

// Basic Structures
export interface TOption<T extends TSchema = TSchema> extends TSchema {
  $id: string;
  [Kind]: "Option";
  static: Static<T, this["params"]> | null;
  option: T;
  type: "option";
}
export function Option<T extends TSchema>(schema: T): TOption<T> {
  return {
    ...Type.Unsafe(),
    $id: `Option[${schema.$id ?? "?"}]`,
    [Kind]: "Option",
    option: schema,
    type: "option",
  };
}

export type TList<T extends TSchema = TSchema> = TArray<T>;
export function List<T extends TSchema>(schema: T): TArray<T> {
  return Type.Array(schema, { $id: `[]${schema.$id ?? "?"}` });
}

export interface TMap<K extends TSchema = TSchema, V extends TSchema = TSchema>
  extends TSchema {
  $id: string;
  [Kind]: "Map";
  static: [Static<K, this["params"]>, Static<V, this["params"]>][];
  key: K;
  value: V;
  type: "map";
}
export function Map<K extends TSchema, V extends TSchema>(
  keySchema: K,
  valueSchema: V
): TMap<K, V> {
  return {
    ...Type.Unsafe(),
    $id: `Map[${keySchema.$id ?? "?"}]${valueSchema.$id ?? "?"}`,
    [Kind]: "Map",
    key: keySchema,
    value: valueSchema,
    type: "map",
  };
}

// Constructs
export const Void = Type.Void();

export interface TInline<T extends TSchema = TSchema> extends TSchema {
  [Kind]: "Inline";
  static: Static<T>;
  schema: T;
  field: string;
  type: "inline";
}
export function Inline<T extends TSchema>(
  schema: T,
  field = "inline"
): TInline<T> {
  return { ...Type.Unsafe(), [Kind]: "Inline", type: "inline", schema, field };
}

export type TStructProps = TProperties | TInline;
export interface TStruct<T extends TStructProps = TStructProps>
  extends TSchema {
  [Kind]: "Object";
  static: T extends TInline
    ? Static<T, this["params"]>
    : T extends TProperties
    ? PropertiesReduce<T, this["params"]>
    : never;
  properties: T;
  type: "struct";
  // Helios structs are encoded using data-lists.
  // Other language's structs are encoded using constrs.
  constr: boolean;
}
function newStruct<T extends TStructProps>(
  constr: boolean,
  properties: T
): TNever | TStruct<T> {
  if (isEmpty(properties)) return Type.Never();
  return {
    ...Type.Unsafe(),
    [Kind]: "Object",
    type: "struct",
    constr,
    properties,
  };
}
export function Struct(properties: Record<string, never>): TNever;
export function Struct<T extends TStructProps>(properties: T): TStruct<T>;
export function Struct<T extends TStructProps>(
  properties: T
): TNever | TStruct<T> {
  return newStruct(false, properties);
}
export function ConStruct(properties: Record<string, never>): TNever;
export function ConStruct<T extends TStructProps>(properties: T): TStruct<T>;
export function ConStruct<T extends TStructProps>(
  properties: T
): TNever | TStruct<T> {
  return newStruct(true, properties);
}

const Error: unique symbol = Symbol.for("Error");
type Error = typeof Error;
type Agg<T> = keyof T extends never
  ? unknown
  : Error extends T[keyof T]
  ? never
  : T[keyof T];

export type TEnumProps = TProperties | TInline | TVoid;
export interface TEnum<
  D extends string = string,
  // eslint-disable-next-line @typescript-eslint/ban-types
  T extends Record<string, TEnumProps> = {}
> extends TSchema {
  [Kind]: "Union";
  static: Agg<{
    [K in keyof T]: K extends string
      ? T[K] extends TVoid
        ? { [L in D]: K }
        : T[K] extends TInline
        ? Simplify<{ [L in D]: K } & Static<T[K], this["params"]>>
        : T[K] extends Record<string, never>
        ? Error
        : PropertiesReduce<{ [L in D]: TLiteral<K> } & T[K], this["params"]>
      : Error;
  }>;
  discriminator: D;
  variants: T;
  type: "enum";
}

export function Enum<D extends string>(
  _: D,
  variants: Record<string, never>
): TNever;
export function Enum<D extends string, T extends Record<string, TEnumProps>>(
  discriminator: D,
  variants: T
): TEnum<D, T>;
export function Enum<D extends string, T extends Record<string, TEnumProps>>(
  discriminator: D,
  variants: T
): TNever | TEnum<D, T> {
  if (variants) {
    return {
      ...Type.Unsafe(),
      [Kind]: "Union",
      discriminator,
      variants,
      type: "enum",
    };
  } else return Type.Never();
}

// Identity
type Id<I extends string, T extends TSchema> = { $id: I } & T;
export function Id<I extends string>(
  id: I
): <T extends TSchema>(schema: T) => Id<I, T> {
  return (schema) => ({ ...schema, $id: id });
}
