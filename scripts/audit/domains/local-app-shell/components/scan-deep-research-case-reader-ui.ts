import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { requireAstMarker, requireIdentifier } from "./deep-research-ui-ast.js";

export const inspectDeepResearchCaseReaderUi = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const reportViewFile = input.context.project.getSourceFile("src/app/workbench-deep-research-report-view.ts");
  const reportSectionsFile = input.context.project.getSourceFile("src/app/workbench-deep-research-client-report-sections.ts");
  const clientBootFile = input.context.project.getSourceFile("src/app/workbench-deep-research-client-boot.ts");

  for (const marker of [
    "data-deep-research-final-card",
    "data-deep-research-primary-business-report",
    "data-deep-research-research-plan",
    "data-deep-research-analysis-cards",
    "data-deep-research-full-case-file",
    "data-deep-research-process-trace",
  ]) {
    requireAstMarker({
      findings: input.findings,
      inspectedFiles: input.inspectedFiles,
      sourceFile: reportViewFile,
      lawId: input.lawId,
      checkId: "local-app-shell/deep-research-case-reader-marker",
      marker,
    });
  }

  for (const identifierName of [
    "renderResearchPlan",
    "renderAnalysisCards",
  ]) {
    requireIdentifier({
      findings: input.findings,
      inspectedFiles: input.inspectedFiles,
      sourceFile: reportSectionsFile,
      lawId: input.lawId,
      checkId: "local-app-shell/deep-research-case-reader-render",
      identifierName,
    });
  }

  requireIdentifier({
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    sourceFile: clientBootFile,
    lawId: input.lawId,
    checkId: "local-app-shell/deep-research-case-reader-boot",
    identifierName: "renderSelectedReport",
  });
};