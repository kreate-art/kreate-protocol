import { Program } from "@hyperionbt/helios";

const $Helios = Symbol("HeliosSource");

export type HeliosSource = {
  [$Helios]: string;
};

export function helios(
  strings: TemplateStringsArray,
  ...values: string[]
): HeliosSource {
  return { [$Helios]: String.raw({ raw: strings }, ...values) };
}

export function newProgram(
  main: HeliosSource,
  modules?: HeliosSource[]
): Program {
  return Program.new(
    main[$Helios],
    modules?.map((s) => s[$Helios])
  );
}
