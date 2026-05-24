import { readFileSync } from "node:fs";

import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../../shared/paths.js";
import { getRepoSourcePath } from "../../../shared/source-files.js";

const panelPath = "src/app/workbench-deep-research-panel.ts";
const historyViewPath = "src/app/workbench-deep-research-history-view.ts";
const reportViewPath = "src/app/workbench-deep-research-report-view.ts";
const stylesPath = "src/app/workbench-deep-research-styles.ts";
const clientPath = "src/app/workbench-deep-research-client.ts";
const clientReportSectionsPath = "src/app/workbench-deep-research-client-report-sections.ts";
const clientSharedPath = "src/app/workbench-deep-research-client-shared.ts";
const clientBootPath = "src/app/workbench-deep-research-client-boot.ts";
const routesPath = "src/app/workbench-deep-research-routes.ts";
const clientRuntimePaths = [clientPath, clientReportSectionsPath, clientSharedPath, clientBootPath] as const;

const readRepoFile = (repoPath: string): string => readFileSync(resolveFromRepo(repoPath), "utf8");

const getSourceFile = (context: InspectorContext, repoPath: string): SourceFile | undefined =>
  context.project.getSourceFile(resolveFromRepo(repoPath));

const pushFinding = (
  findings: InspectorFinding[],
  input: {
    checkId: string;
    lawId: string;
    filePath: string;
    message: string;
  },
): void => {
  findings.push(createFinding(input));
};

const requireText = (
  findings: InspectorFinding[],
  lawId: string,
  filePath: string,
  marker: string,
): void => {
  if (readRepoFile(filePath).includes(marker)) {
    return;
  }
  pushFinding(findings, {
    checkId: "local-app-shell/deep-research-reader-marker",
    lawId,
    filePath,
    message: `${filePath} must contain ${marker}.`,
  });
};

const requireTextInAnyFile = (
  findings: InspectorFinding[],
  lawId: string,
  filePaths: readonly string[],
  marker: string,
): void => {
  if (filePaths.some((filePath) => readRepoFile(filePath).includes(marker))) {
    return;
  }
  pushFinding(findings, {
    checkId: "local-app-shell/deep-research-reader-marker",
    lawId,
    filePath: clientPath,
    message: `${filePaths.join(", ")} must contain ${marker}.`,
  });
};

const requireImport = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  lawId: string;
  filePath: string;
  symbolName: string;
  moduleSuffix: string;
}): void => {
  const sourceFile = getSourceFile(input.context, input.filePath);
  const found = sourceFile?.getImportDeclarations().some((declaration) =>
    declaration.getModuleSpecifierValue().endsWith(input.moduleSuffix)
    && declaration.getNamedImports().some((namedImport) => namedImport.getName() === input.symbolName),
  );
  if (found) return;
  pushFinding(input.findings, {
    checkId: "local-app-shell/deep-research-reader-import",
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.filePath} must import ${input.symbolName} from ${input.moduleSuffix}.`,
  });
};

const requireCall = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  lawId: string;
  filePath: string;
  symbolName: string;
}): void => {
  const sourceFile = getSourceFile(input.context, input.filePath);
  const found = sourceFile?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    call.getExpression().getText() === input.symbolName,
  );
  if (found) return;
  pushFinding(input.findings, {
    checkId: "local-app-shell/deep-research-reader-call",
    lawId: input.lawId,
    filePath: input.filePath,
    message: `${input.filePath} must call ${input.symbolName}.`,
  });
};

const inspectPanelComposition = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  deliveryLawId: string;
}): void => {
  requireImport({
    context: input.context,
    findings: input.findings,
    lawId: input.deliveryLawId,
    filePath: panelPath,
    symbolName: "renderDeepResearchHistoryView",
    moduleSuffix: "./workbench-deep-research-history-view.js",
  });
  requireImport({
    context: input.context,
    findings: input.findings,
    lawId: input.deliveryLawId,
    filePath: panelPath,
    symbolName: "renderDeepResearchReportView",
    moduleSuffix: "./workbench-deep-research-report-view.js",
  });
  requireCall({
    context: input.context,
    findings: input.findings,
    lawId: input.deliveryLawId,
    filePath: panelPath,
    symbolName: "renderDeepResearchHistoryView",
  });
  requireCall({
    context: input.context,
    findings: input.findings,
    lawId: input.deliveryLawId,
    filePath: panelPath,
    symbolName: "renderDeepResearchReportView",
  });
};

const inspectInputMarkers = (findings: InspectorFinding[], lawId: string): void => {
  for (const marker of [
    "data-deep-research-new-toggle",
    "data-deep-research-form-shell",
    "name=\"userQuestion\"",
    "name=\"language\"",
    "name=\"providerKind\"",
    "name=\"maxSubQuestions\"",
  ]) {
    requireText(findings, lawId, panelPath, marker);
  }
};

const inspectDeliveryMarkers = (findings: InspectorFinding[], lawId: string): void => {
  for (const marker of [
    "data-deep-research-history-shell",
    "data-deep-research-history",
    "data-deep-research-history-search",
  ]) {
    requireText(findings, lawId, historyViewPath, marker);
  }
  for (const marker of [
    "data-deep-research-reader-shell",
    "data-deep-research-final-card",
    "data-deep-research-stage-overview",
    "data-deep-research-decomposition",
    "data-deep-research-subquestions",
    "data-deep-research-final-synthesis",
    "data-deep-research-evidence",
    "data-deep-research-nav",
    "data-deep-research-meta",
  ]) {
    requireText(findings, lawId, reportViewPath, marker);
  }
};

const inspectClientMarkers = (findings: InspectorFinding[], lawId: string): void => {
  for (const marker of [
    "/api/deep-research-analysis/history",
    "/api/deep-research-analysis/report",
    "refreshHistory",
    "loadSelectedReport",
    "renderSelectedReport",
    "Positive Analysis",
    "Falsification",
    "Evidence / Debug",
    "Show Full Prompt",
    "Show Full AI Response",
    "Show Parsed Result",
  ]) {
    requireTextInAnyFile(findings, lawId, clientRuntimePaths, marker);
  }
  for (const marker of [
    "/api/deep-research-analysis/history",
    "/api/deep-research-analysis/report",
  ]) {
    requireText(findings, lawId, routesPath, marker);
  }
};

const inspectDebugBoundaries = (findings: InspectorFinding[], lawId: string): void => {
  const clientText = clientRuntimePaths.map((filePath) => readRepoFile(filePath)).join("\n");
  if (clientText.includes("Raw result record") || clientText.includes("View raw final report JSON")) {
    pushFinding(findings, {
      checkId: "local-app-shell/deep-research-reader-raw-default",
      lawId,
      filePath: clientPath,
      message: "Raw JSON debug must not dominate the default Deep Research report body.",
    });
  }
  const reportViewText = readRepoFile(reportViewPath);
  if (reportViewText.includes("providerProofJson") || reportViewText.includes("raw-json-pre")) {
    pushFinding(findings, {
      checkId: "local-app-shell/deep-research-reader-debug-default",
      lawId,
      filePath: reportViewPath,
      message: "Debug metadata must not be hard-coded into the default report view skeleton.",
    });
  }
};

const inspectLayoutQualityBoundaries = (findings: InspectorFinding[], lawId: string): void => {
  for (const marker of [
    "data-deep-research-layout-contract=\"history-rail-reader\"",
    "data-deep-research-scroll-boundary",
  ]) {
    requireText(findings, lawId, panelPath, marker);
  }
  for (const marker of [
    "data-deep-research-reader-primary",
    "data-deep-research-side-compact",
  ]) {
    requireText(findings, lawId, reportViewPath, marker);
  }
  for (const marker of [
    "max-height: calc(100vh - 128px)",
    "grid-template-columns: minmax(260px, 320px) minmax(0, 1fr)",
    "grid-template-columns: minmax(0, 1fr);",
    "grid-template-columns: repeat(4, minmax(0, 1fr))",
    "research-delivery-strip",
  ]) {
    requireText(findings, lawId, stylesPath, marker);
  }
  if (readRepoFile(stylesPath).includes("grid-template-columns: minmax(0, 1fr) 240px")) {
    pushFinding(findings, {
      checkId: "local-app-shell/deep-research-reader-narrow-column",
      lawId,
      filePath: stylesPath,
      message: "Deep Research reader must not reserve a fixed 240px side column inside the already constrained workspace.",
    });
  }
};

export const inspectDeepResearchReportReaderUi = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  inputLawId: string;
  deliveryLawId: string;
}): void => {
  [panelPath, historyViewPath, reportViewPath, stylesPath, ...clientRuntimePaths, routesPath].forEach((repoPath) => {
    input.inspectedFiles.add(repoPath);
  });
  inspectPanelComposition({
    context: input.context,
    findings: input.findings,
    deliveryLawId: input.deliveryLawId,
  });
  inspectInputMarkers(input.findings, input.inputLawId);
  inspectDeliveryMarkers(input.findings, input.deliveryLawId);
  inspectClientMarkers(input.findings, input.deliveryLawId);
  inspectDebugBoundaries(input.findings, input.deliveryLawId);
  inspectLayoutQualityBoundaries(input.findings, input.deliveryLawId);
  clientRuntimePaths.forEach((repoPath) => {
    const clientSource = getSourceFile(input.context, repoPath);
    if (clientSource) {
      input.inspectedFiles.add(getRepoSourcePath(clientSource));
    }
  });
};
