import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

const routesPath = "src/app/workbench-amazon-routes.ts";
const uploadCompatibilityKeys = [
  "requireHumanFinalSubmit",
  "stopOnManualRequired",
] as const;

export const inspectUploadRouteSanitizer = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!file) return;
  const sanitizer = file.getFunction("sanitizeAmazonInvoiceUploadMission");
  const startHandler = file.getFunction("handleAmazonPluginStartRequest");
  const callsSanitizer = startHandler?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "sanitizeAmazonInvoiceUploadMission");
  if (!sanitizer || !callsSanitizer) {
    findings.push(createFinding({
      checkId: "amazon-invoice-upload/upload-route-sanitizer-missing",
      lawId,
      filePath: routesPath,
      message: "External upload route must sanitize non-control legacy fields before calling the existing single upload task service.",
    }));
    return;
  }
  const deleted = new Set(sanitizer.getDescendantsOfKind(SyntaxKind.DeleteExpression).flatMap((item) => {
    const expression = item.getExpression();
    return Node.isPropertyAccessExpression(expression) ? [expression.getName()] : [];
  }));
  for (const key of [...uploadCompatibilityKeys, "sourceSystem", "requestId"]) {
    if (!deleted.has(key)) {
      findings.push(createFinding({
        checkId: "amazon-invoice-upload/upload-route-sanitizer-field",
        lawId,
        filePath: routesPath,
        message: `External upload route sanitizer must drop non-schema field ${key} before the single upload service parses the strict mission contract.`,
      }));
    }
  }
};
