import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { forbidAstMarker, requireAstMarker } from "./deep-research-ui-ast.js";

export const inspectDeepResearchCleanRawIndexUi = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const caseReaderFile = input.context.project.getSourceFile("src/app/workbench-deep-research-client-case-reader.ts");
  const sharedFile = input.context.project.getSourceFile("src/app/workbench-deep-research-client-shared.ts");

  for (const marker of [
    "Clean Answer",
    "Raw AI Response",
    "Index JSON",
    "Index Notes",
    "Rendered Prompt",
  ]) {
    requireAstMarker({
      findings: input.findings,
      inspectedFiles: input.inspectedFiles,
      sourceFile: caseReaderFile,
      lawId: input.lawId,
      checkId: "local-app-shell/deep-research-clean-raw-index-marker",
      marker,
    });
  }

  forbidAstMarker({
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    sourceFile: sharedFile,
    lawId: input.lawId,
    checkId: "local-app-shell/deep-research-summary-forbidden",
    marker: "renderExpandableText(\"Summary\", block.answerText",
  });
};