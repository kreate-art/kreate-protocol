import { pathsToModuleNameMapper } from "ts-jest";

// In the following statement, replace `./tsconfig` with the path to your `tsconfig` file
// which contains the path mapping (ie the `compilerOptions.paths` option):
import { compilerOptions } from "./tsconfig.json";

import type { JestConfigWithTsJest } from "ts-jest";

const esModules = ["@hyperionbt/helios"].join("|");

const jestConfig: JestConfigWithTsJest = {
  testEnvironment: "node",
  roots: ["<rootDir>"],
  extensionsToTreatAsEsm: [".ts"],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: {
    "(.+)\\.[jt]sx?": "$1",
    ...pathsToModuleNameMapper(compilerOptions.paths),
  },
  transformIgnorePatterns: [`node_modules/(?!${esModules})`],
  transform: {
    "^.+\\.[tj]sx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.test.json",
        isolatedModules: true,
        useESM: true,
      },
    ],
  },
};

export default jestConfig;
