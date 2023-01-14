import { Program } from "@hyperionbt/helios";

import { assert } from "@/utils";

export type HeliosSource = {
  name: string;
  source: string;
  dependencies: string[];
};

export type HeliosModules = Record<string, HeliosSource>;

function template(strings: TemplateStringsArray, ...values: string[]) {
  return String.raw({ raw: strings }, ...values);
}

export function helios(
  name: string,
  dependencies: string[] = []
): (strings: TemplateStringsArray, ...values: string[]) => HeliosSource {
  return (strings, ...values) => ({
    name,
    source: template(strings, ...values),
    dependencies,
  });
}

export function newProgram(
  main: HeliosSource,
  modules: HeliosModules
): Program {
  const modSrcs: string[] = [];
  const visited = new Set<string>();
  function dfs(mod: HeliosSource) {
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

export function heliosModules(modules: HeliosSource[]): HeliosModules {
  return Object.fromEntries(modules.map((mod) => [mod.name, mod]));
}
