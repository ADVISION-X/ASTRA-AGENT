import { Node, SyntaxKind, type SourceFile } from "ts-morph";

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

const hasCall = (sourceFile: SourceFile | undefined, symbolName: string): boolean =>
  (sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? []).some((call) =>
    call.getExpression().getText() === symbolName,
  );

const pushMissingMarker = (input: {
  findings: InspectorFinding[];
  lawId: string;
  filePath: string;
  checkId: string;
  marker: string;
  messagePrefix: string;
}): void => {
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.messagePrefix} ${input.marker}.`,
  }));
};

export const inspectFullCaseFileSovereignty = (input: {
  analysisFinalizationFile: SourceFile | undefined;
  fullCaseFileFile: SourceFile | undefined;
  fullCaseFileRenderFile: SourceFile | undefined;
  fullCaseFileExportFile: SourceFile | undefined;
  exportFile: SourceFile | undefined;
  recordContractsFile: SourceFile | undefined;
  acceptanceFile: SourceFile | undefined;
  ciFullFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  markInspected(input.inspectedFiles, [
    input.analysisFinalizationFile,
    input.fullCaseFileFile,
    input.fullCaseFileRenderFile,
    input.fullCaseFileExportFile,
    input.exportFile,
    input.recordContractsFile,
    input.acceptanceFile,
    input.ciFullFile,
  ]);

  if (!input.fullCaseFileFile?.getFunction("buildDeepResearchFullCaseFile") && !input.fullCaseFileFile?.getVariableDeclaration("buildDeepResearchFullCaseFile")) {
    input.findings.push(createFinding({
      checkId: "deep-research/full-case-file-builder",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.ts",
      message: "Full case file sovereignty requires buildDeepResearchFullCaseFile.",
    }));
  }
  if (!input.fullCaseFileRenderFile?.getFunction("renderDeepResearchFullCaseFileMarkdown") && !input.fullCaseFileRenderFile?.getVariableDeclaration("renderDeepResearchFullCaseFileMarkdown")) {
    input.findings.push(createFinding({
      checkId: "deep-research/full-case-file-render",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-render.ts",
      message: "Full case file sovereignty requires renderDeepResearchFullCaseFileMarkdown.",
    }));
  }
  if (!input.fullCaseFileExportFile?.getFunction("saveFullCaseFileExports") && !input.fullCaseFileExportFile?.getVariableDeclaration("saveFullCaseFileExports")) {
    input.findings.push(createFinding({
      checkId: "deep-research/full-case-file-export-helper",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.full-case-file-export.ts",
      message: "Full case file sovereignty requires saveFullCaseFileExports.",
    }));
  }
  if (!hasCall(input.exportFile, "saveFullCaseFileExports")) {
    input.findings.push(createFinding({
      checkId: "deep-research/full-case-file-export-call",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.export.ts",
      message: "Deep Research export must persist full-case-file exports.",
    }));
  }

  const finalizationText = input.analysisFinalizationFile?.getFullText() ?? "";
  for (const marker of [
    "buildDeepResearchFullCaseFile",
    "renderDeepResearchFullCaseFileMarkdown",
    "fullCaseFileMarkdown",
    "full-case-file",
  ]) {
    if (finalizationText.includes(marker)) {
      continue;
    }
    pushMissingMarker({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.analysis-finalization.ts",
      checkId: "deep-research/full-case-file-finalization-marker",
      marker,
      messagePrefix: "Analysis finalization must include",
    });
  }

  const recordContractsText = input.recordContractsFile?.getFullText() ?? "";
  for (const exportKind of ["full-case-file.md", "full-case-file.json"]) {
    if (recordContractsText.includes(exportKind)) {
      continue;
    }
    pushMissingMarker({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts",
      checkId: "deep-research/full-case-file-record-contract",
      marker: exportKind,
      messagePrefix: "Record contracts must expose",
    });
  }

  const acceptanceText = input.acceptanceFile?.getFullText() ?? "";
  for (const marker of ["full-case-file.md", "full-case-file.json", "saveFullCaseFileExports"]) {
    if (acceptanceText.includes(marker)) {
      continue;
    }
    pushMissingMarker({
      findings: input.findings,
      lawId: input.lawId,
      filePath: "scripts/acceptance/deep-research-full-case-file.acceptance.ts",
      checkId: "deep-research/full-case-file-acceptance-marker",
      marker,
      messagePrefix: "Full case file acceptance must include",
    });
  }

  const ciText = input.ciFullFile?.getFullText() ?? "";
  if (!ciText.includes("acceptance:deep-research-full-case-file")) {
    input.findings.push(createFinding({
      checkId: "deep-research/full-case-file-ci",
      lawId: input.lawId,
      filePath: "scripts/audit/ci-full.ts",
      message: "ci:full must execute acceptance:deep-research-full-case-file.",
    }));
  }
};
