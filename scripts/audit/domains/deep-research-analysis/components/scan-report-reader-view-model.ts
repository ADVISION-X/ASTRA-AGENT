import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorFinding } from "../../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const hasIdentifier = (node: Node, identifierName: string): boolean =>
  node.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => identifier.getText() === identifierName);

const getArrowInitializer = (sourceFile: SourceFile, variableName: string) => {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const initializer = declaration?.getInitializer();
  return initializer && Node.isArrowFunction(initializer) ? initializer : null;
};

const hasLiteralContaining = (node: Node, fragment: string): boolean =>
  node.getDescendants().some((descendant) =>
    (Node.isStringLiteral(descendant) || Node.isNoSubstitutionTemplateLiteral(descendant))
      && descendant.getLiteralValue().includes(fragment));

const inspectContracts = (input: {
  contractFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
}): boolean => {
  if (!input.contractFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-reader-contract-file",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.public-contracts.ts",
      message: "Report reader contracts file must exist.",
    }));
    return false;
  }
  if (!input.contractFile.getTypeAlias("DeepResearchHistorySnapshot")) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-reader-history-contract",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.contractFile),
      message: "DeepResearchHistorySnapshot must be declared for persisted history delivery.",
    }));
  }
  if (!input.contractFile.getTypeAlias("DeepResearchReportViewModel")) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-reader-view-model-contract",
      lawId: input.lawId,
      filePath: getRepoSourcePath(input.contractFile),
      message: "DeepResearchReportViewModel must be declared for report reader delivery.",
    }));
  }
  return true;
};

const inspectHistoryQuery = (input: {
  queriesFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const repoPath = getRepoSourcePath(input.queriesFile);
  const historyQuery = getArrowInitializer(input.queriesFile, "listDeepResearchAnalysisHistory");
  if (!historyQuery || !["withStore", "listJobs", "buildHistoryJobView"].every((identifier) => hasIdentifier(historyQuery, identifier))) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-reader-history-builder",
      lawId: input.lawId,
      filePath: repoPath,
      message: "History list must be built from persisted jobs through withStore + listJobs + buildHistoryJobView.",
    }));
  }
  if (!hasLiteralContaining(input.queriesFile, "SELECT * FROM research_jobs")) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-reader-history-db",
      lawId: input.lawId,
      filePath: repoPath,
      message: "History list must read persisted research_jobs records.",
    }));
  }
};

const inspectReportBuilder = (input: {
  queriesFile: SourceFile;
  findings: InspectorFinding[];
  lawId: string;
}): void => {
  const repoPath = getRepoSourcePath(input.queriesFile);
  const reportBuilder = getArrowInitializer(input.queriesFile, "buildReportViewModel");
  if (!reportBuilder || ![
    "buildTimelineSnapshot",
    "subQuestionReports",
    "answerByKindAndSubQuestionId",
    "conflictBySubQuestionId",
    "snapshot",
  ].every((identifier) => hasIdentifier(reportBuilder, identifier))) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-reader-pair-builder",
      lawId: input.lawId,
      filePath: repoPath,
      message: "Report view model must pair sub-questions with independent analysis records while still preserving legacy positive, falsification, and conflict support.",
    }));
  }
  const reportQuery = getArrowInitializer(input.queriesFile, "getDeepResearchAnalysisReport");
  if (!reportQuery || !hasIdentifier(reportQuery, "buildReportViewModel")) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-reader-report-query",
      lawId: input.lawId,
      filePath: repoPath,
      message: "getDeepResearchAnalysisReport must delegate to buildReportViewModel.",
    }));
  }
  if (hasIdentifier(input.queriesFile, "localStorage") || hasLiteralContaining(input.queriesFile, "executions")) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-reader-transient-memory",
      lawId: input.lawId,
      filePath: repoPath,
      message: "Report reader view model must not depend on transient browser or execution memory.",
    }));
  }
};

export const inspectReportReaderViewModel = (input: {
  queriesFile: SourceFile | undefined;
  contractFile: SourceFile | undefined;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  if (input.queriesFile) {
    input.inspectedFiles.add(getRepoSourcePath(input.queriesFile));
  }
  if (input.contractFile) {
    input.inspectedFiles.add(getRepoSourcePath(input.contractFile));
  }
  if (!inspectContracts({
    contractFile: input.contractFile,
    findings: input.findings,
    lawId: input.lawId,
  })) {
    return;
  }
  if (!input.queriesFile) {
    input.findings.push(createFinding({
      checkId: "deep-research/report-reader-query-file",
      lawId: input.lawId,
      filePath: "src/plugins/deep-research-analysis/deep-research-analysis.public-queries.ts",
      message: "Report reader query file must exist.",
    }));
    return;
  }
  inspectHistoryQuery({
    queriesFile: input.queriesFile,
    findings: input.findings,
    lawId: input.lawId,
  });
  inspectReportBuilder({
    queriesFile: input.queriesFile,
    findings: input.findings,
    lawId: input.lawId,
  });
};
