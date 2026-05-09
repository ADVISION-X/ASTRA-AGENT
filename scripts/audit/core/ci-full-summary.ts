import { readJsonFile, writeJsonFile } from "./filesystem.js";
import { generatedArtifactPaths } from "./generated-artifact-paths.js";
import type { CiFullLayerLabel } from "./ci-full-check-ownership.js";

export type CiFullStepStatus = "PASS" | "FAIL" | "SKIPPED";
export type CiFullLayerStatus = "PASS" | "FAIL" | "SKIPPED";

export type CiFullStepSummary = {
  checkId: string;
  layer: CiFullLayerLabel;
  command: string;
  producer: string;
  allowedConsumers: string[];
  exclusive: true;
  status: CiFullStepStatus;
  exitCode: number | null;
  durationMs: number;
  memoryPeakMb: number;
  artifactPaths: string[];
};

export type CiFullLayerSummary = {
  label: CiFullLayerLabel;
  status: CiFullLayerStatus;
  steps: CiFullStepSummary[];
};

export type CiFullSummary = {
  generatedAt: string;
  status: "PASS" | "FAIL";
  layers: CiFullLayerSummary[];
};

export const buildCiFullCommand = (args: string[]): string => `npm ${args.join(" ")}`;

export const writeCiFullSummary = async (summary: CiFullSummary): Promise<void> => {
  await writeJsonFile(generatedArtifactPaths.ciFullSummary, summary);
};

export const readCiFullSummary = async (): Promise<CiFullSummary> =>
  readJsonFile<CiFullSummary>(generatedArtifactPaths.ciFullSummary);

export const getCiFullLayerStatus = (steps: CiFullStepSummary[]): CiFullLayerStatus => {
  if (steps.some((step) => step.status === "FAIL")) {
    return "FAIL";
  }

  if (steps.some((step) => step.status === "SKIPPED")) {
    return "SKIPPED";
  }

  return "PASS";
};