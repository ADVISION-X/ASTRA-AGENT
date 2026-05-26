import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import { forbidAstMarker, requireAstMarker } from "./deep-research-ui-ast.js";

export const inspectDeepResearchHtmlDeliveryStatusUi = (input: {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
}): void => {
  const deliveryFile = input.context.project.getSourceFile("src/app/workbench-deep-research-client-delivery-sections.ts");

  for (const marker of [
    "sourceKind",
    "fileHash",
    "fileSizeBytes",
    "failureReason",
    "reviewReason",
    "Open HTML Report",
    "Download HTML Report",
  ]) {
    requireAstMarker({
      findings: input.findings,
      inspectedFiles: input.inspectedFiles,
      sourceFile: deliveryFile,
      lawId: input.lawId,
      checkId: "local-app-shell/deep-research-html-delivery-marker",
      marker,
    });
  }

  for (const forbidden of [
    "PPT",
    "Deck",
    "Optional Presentation",
  ]) {
    forbidAstMarker({
      findings: input.findings,
      inspectedFiles: input.inspectedFiles,
      sourceFile: deliveryFile,
      lawId: input.lawId,
      checkId: "local-app-shell/deep-research-html-delivery-forbidden",
      marker: forbidden,
    });
  }
};