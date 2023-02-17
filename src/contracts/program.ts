import { Program } from "@hyperionbt/helios";

import { assert } from "@/utils";

export type HeliosScriptPurpose =
  | "spending"
  | "minting"
  | "staking"
  | "testing"
  | "module";

export type HeliosScript = {
  purpose: HeliosScriptPurpose;
  name: string;
  source: string;
  dependencies: string[];
  simplify?: boolean;
};

const HeliosHeaderToken = Symbol.for("HeliosHeaderToken");
export function header(purpose: HeliosScriptPurpose, name: string) {
  return { __tag__: HeliosHeaderToken, purpose, name } as const;
}

const HeliosModuleToken = Symbol.for("HeliosModuleToken");
export function module(name: string) {
  return { __tag__: HeliosModuleToken, name } as const;
}

type HeliosTokens =
  | ReturnType<typeof header>
  | ReturnType<typeof module>
  | boolean
  | string
  | number
  | bigint;

export type HeliosModules = Record<string, HeliosScript>;

export function helios(
  strings: TemplateStringsArray,
  ...tokens: HeliosTokens[]
): HeliosScript {
  let purpose: HeliosScriptPurpose | undefined = undefined;
  let name: string | undefined = undefined;
  const dependencies: string[] = [];
  const values = [];

  for (const token of tokens) {
    assert(token != null, "null and undefined are not allowed");
    if (typeof token === "object") {
      assert("__tag__" in token, "objects are not allowed");
      switch (token.__tag__) {
        case HeliosHeaderToken:
          purpose = token.purpose;
          name = token.name;
          values.push(`${purpose} ${name}`);
          break;
        case HeliosModuleToken:
          dependencies.push(token.name);
          values.push(token.name);
          break;
      }
    } else if (typeof token === "boolean") {
      values.push(token ? "true" : "false");
    } else {
      values.push(token);
    }
  }
  assert(purpose && name, "Script purpose and name must be set");
  return {
    purpose,
    name,
    source: String.raw({ raw: strings }, ...values),
    dependencies,
  };
}

export function newProgram(
  main: HeliosScript,
  modules: HeliosModules
): Program {
  const modSrcs: string[] = [];
  const visited = new Set<string>();
  function dfs(mod: HeliosScript) {
    visited.add(mod.name);
    if (mod !== main) modSrcs.push(mod.source);
    for (const dep of mod.dependencies)
      if (!visited.has(dep)) {
        const depMod = modules[dep];
        assert(depMod, `Module ${dep} not found!`);
        dfs(depMod);
      }
  }
  dfs(main);
  return Program.new(main.source, modSrcs);
}

export function loadModules(modules: HeliosScript[]): HeliosModules {
  return Object.fromEntries(modules.map((mod) => [mod.name, mod]));
}
