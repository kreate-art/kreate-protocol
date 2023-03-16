import * as helios from "@hyperionbt/helios";

// helper functions for script property tests
export function asBool(value: helios.UplcData | helios.UplcValue): boolean {
  if (value instanceof helios.UplcBool) {
    return value.bool;
  } else if (value instanceof helios.ConstrData) {
    if (value.fields.length == 0) {
      if (value.index == 0) {
        return false;
      } else if (value.index == 1) {
        return true;
      } else {
        throw new Error(
          `unexpected ConstrData index ${value.index} (expected 0 or 1 for Bool)`
        );
      }
    } else {
      throw new Error(`expected ConstrData with 0 fields (Bool)`);
    }
  } else if (value instanceof helios.UplcDataValue) {
    return asBool(value.data);
  }

  throw new Error(`expected UplcBool, got ${value.toString()}`);
}

export function asInt(value: helios.UplcValue) {
  if (value instanceof helios.IntData) {
    return value.value;
  } else if (value instanceof helios.UplcDataValue) {
    const data = value.data;
    if (data instanceof helios.IntData) {
      return data.value;
    }
  }

  throw new Error(`expected IntData, got ${value.toString()}`);
}
