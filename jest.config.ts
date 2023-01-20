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
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/dist/"],
  modulePaths: [compilerOptions.baseUrl],
  moduleNameMapper: {
    "(bignumber\\.js)": "$1",
    "(.+)\\.[jt]sx?": "$1",
    ...pathsToModuleNameMapper(compilerOptions.paths, { useESM: true }),
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
  setupFiles: ["<rootDir>/tests/setup.ts"],
};

export default jestConfig;
