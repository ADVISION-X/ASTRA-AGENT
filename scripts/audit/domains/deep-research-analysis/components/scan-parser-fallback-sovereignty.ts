import type { SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const markInspected = (inspectedFiles: Set<string>, sourceFiles: readonly (SourceFile | undefined)[]): void => {
  sourceFiles.forEach((sourceFile) => {
    if (sourceFile) {
      inspectedFiles.add(getRepoSourcePath(sourceFile));
    }
  });
};

export const inspectParserFallbackSovereignty = (input: {
  parserSupportFile: SourceFile | undefined;
  schemaFile: SourceFile | undefined;
  fullCaseFileFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  markInspected(input.inspectedFiles, [
    input.parserSupportFile,
    input.schemaFile,
    input.fullCaseFileFile,
    input.acceptanceFile,
    input.ciFullFile,
  ]);

  const parserSupportText = input.parserSupportFile?.getFullText() ?? "";
  for (const marker of [
    '"parse_failed_raw_available"',
    'normalizedText\n    ? "parse_failed_raw_available"\n    : "failed_empty"',
    '"parse_failed_raw_available",',
  ]) {
    if (parserSupportText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/parser-fallback-marker",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.parser-support.ts",
      message: `Parser fallback sovereignty must include marker: ${marker}.`,
    }));
  }

  if (!(input.schemaFile?.getFullText() ?? "").includes('"parse_failed_raw_available"')) {
    input.findings.push(createFinding({
      checkId: "deep-research/parser-fallback-schema",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts",
      message: "Deep Research schema must expose parse_failed_raw_available.",
    }));
  }

  const fullCaseText = input.fullCaseFileFile?.getFullText() ?? "";
  for (const marker of ["parse_failed_raw_available", "failedButRawAvailableInteractions", 'structuredAnswerStatus: answer']) {
    if (fullCaseText.includes(marker)) {
      continue;
    }
    input.findings.push(createFinding({
      checkId: "deep-research/parser-fallback-full-case-marker",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
      message: `Full case file builder must include marker: ${marker}.`,
    }));
  }

  const acceptanceText = input.acceptanceFile?.getFullText() ?? "";
  if (!acceptanceText.includes("buildFailure") || !acceptanceText.includes("refineSchemaResult")) {
    input.findings.push(createFinding({
      checkId: "deep-research/parser-fallback-acceptance",
      lawId: input.lawId,
      filePath: "scripts/acceptance/deep-research-parser-fallback.acceptance.ts",
      message: "Parser fallback acceptance must assert buildFailure and refineSchemaResult raw-content preservation.",
    }));
  }

  if (!(input.ciFullFile?.getFullText() ?? "").includes("acceptance:deep-research-parser-fallback")) {
    input.findings.push(createFinding({
      checkId: "deep-research/parser-fallback-ci",
      lawId: input.lawId,
      filePath: "scripts/audit/ci-full.ts",
      message: "ci:full must execute acceptance:deep-research-parser-fallback.",
    }));
  }
};