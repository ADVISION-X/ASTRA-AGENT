import { readFileSync } from "node:fs";

import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const forbiddenIdentifiers = new Set([
  decode("cnVuQnVzaW5lc3NEZWNrUGhhc2U="),
  decode("cnVuUHB0QXJ0aWZhY3RQaGFzZQ=="),
  "runPositivePhase",
  "runFalsificationPhase",
]);

const hasString = (sourceFile: SourceFile, value: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).some((literal) => literal.getLiteralValue() === value);

const requireRepoMarker = (input: {
  repoPath: string;
  marker: string;
  checkId: string;
  message: string;
  lawId: string;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
}): void => {
  input.inspectedFiles.add(input.repoPath);
  const text = readFileSync(resolveFromRepo(input.repoPath), "utf8");
  if (text.includes(input.marker)) {
    return;
  }
  input.findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.repoPath,
    message: input.message,
  }));
};

export const inspectSingleFlowSovereignty = (input: {
  analysisRunnerFile: SourceFile | undefined;
  finalPackageFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  for (const sourceFile of [input.analysisRunnerFile, input.finalPackageFile]) {
    if (!sourceFile) continue;
    const repoPath = getRepoSourcePath(sourceFile);
    input.inspectedFiles.add(repoPath);
    sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).forEach((identifier) => {
      if (!forbiddenIdentifiers.has(identifier.getText())) return;
      input.findings.push(createFinding({
        checkId: "deep-research/single-flow-forbidden-identifier",
        lawId: input.lawId,
        filePath: repoPath,
        message: `Forbidden Deep Research phase identifier remains: ${identifier.getText()}.`,
      }));
    });
  }
  if (!input.finalPackageFile || !hasString(input.finalPackageFile, "default_1_n_1_1")) {
    input.findings.push(createFinding({
      checkId: "deep-research/single-flow-mode",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.final-package.ts",
      message: "Final package must expose only flowMode default_1_n_1_1.",
    }));
  }

  requireRepoMarker({
    repoPath: "src/plugins/deep-research-analysis/deep-research-analysis.record-contracts.ts",
    marker: 'z.literal("default_1_n_1_1")',
    checkId: "deep-research/single-flow-record-contracts",
    message: "Record contracts must bind flowMode to default_1_n_1_1.",
    ...input,
  });
  requireRepoMarker({
    repoPath: "src/app/workbench-deep-research-client-report-sections.ts",
    marker: "Default 1+N+1+1",
    checkId: "deep-research/single-flow-report-view",
    message: "Workbench report reader must present Default 1+N+1+1 as the only flow label.",
    ...input,
  });
  requireRepoMarker({
    repoPath: "scripts/acceptance/deep-research-single-flow.acceptance.ts",
    marker: "deep-research-single-flow",
    checkId: "deep-research/single-flow-acceptance",
    message: "Single-flow sovereignty acceptance must exist.",
    ...input,
  });
  requireRepoMarker({
    repoPath: "scripts/audit/ci-full.ts",
    marker: "acceptance:deep-research-single-flow",
    checkId: "deep-research/single-flow-ci",
    message: "ci:full must execute acceptance:deep-research-single-flow.",
    ...input,
  });
};
