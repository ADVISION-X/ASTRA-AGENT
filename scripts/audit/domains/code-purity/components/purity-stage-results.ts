import { stat } from "node:fs/promises";

import { fileExists, readJsonFile, writeJsonFile } from "../../../core/filesystem.js";
import { generatedArtifactPaths } from "../../../core/generated-artifact-paths.js";
import { pathFromRepoRoot } from "../../../core/paths.js";
import type { GeneratedLawRegistry } from "../../../core/schema-generated-artifacts.js";
import { CODE_PURITY_SCAN_SUMMARY, CODE_PURITY_WORK_DIR } from "./purity-stage-paths.js";
import type { CodePurityReportResult, CodePurityScanSummary } from "./purity-stage-types.js";

export const writeScanSummary = async (summary: CodePurityScanSummary): Promise<void> => {
  await writeJsonFile(pathFromRepoRoot(CODE_PURITY_SCAN_SUMMARY), summary);
};

export const readScanSummary = async (): Promise<CodePurityScanSummary> =>
  readJsonFile<CodePurityScanSummary>(pathFromRepoRoot(CODE_PURITY_SCAN_SUMMARY));

export const writeCodePurityReportResult = async (result: CodePurityReportResult): Promise<void> => {
  await writeJsonFile(pathFromRepoRoot(`${CODE_PURITY_WORK_DIR}/report-result.generated.json`), result);
};

export const readCodePurityReportResult = async (): Promise<CodePurityReportResult> =>
  readJsonFile<CodePurityReportResult>(pathFromRepoRoot(`${CODE_PURITY_WORK_DIR}/report-result.generated.json`));

export const loadCodePurityLawRegistry = async (): Promise<GeneratedLawRegistry> => {
  if (!(await fileExists(generatedArtifactPaths.lawRegistry))) {
    throw new Error("Code-purity requires generated law registry. Run `npm run audit:build` first, or set GRASSEYE_CODE_PURITY_BUILD_ARTIFACTS=1 for an explicit rebuild.");
  }
  const registry = await readJsonFile<GeneratedLawRegistry>(generatedArtifactPaths.lawRegistry);
  return {
    ...registry,
    laws: registry.laws.filter((law) => law.relativeFilePath === ".github/instructions/cursor-rules/modules/module-code-purity.instructions.md"),
  };
};

export const assertFreshStreamArtifact = async (relativePath: string): Promise<void> => {
  const info = await stat(pathFromRepoRoot(relativePath));
  if (!info.isFile()) {
    throw new Error(`Expected code-purity artifact file at ${relativePath}.`);
  }
};
