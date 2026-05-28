import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { getRepoSourcePath } from "../../shared/source-files.js";

const forbiddenUiTerms = [
  "Buy",
  "Purchase",
  "Sample Now",
  "Procure",
  "Place Order",
  "Launch Listing",
  "Run Ads",
  "Create Shipment",
  "Allocate Inventory",
  "Final Pick",
  "Select Winner",
  "Profit Decision",
  "Auto Sell",
  "Auto Purchase",
] as const;

const appTextNodes = (sourceFile: SourceFile): string[] => [
  ...sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateHead).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((node) => node.getLiteralText()),
  ...sourceFile.getDescendantsOfKind(SyntaxKind.TemplateTail).map((node) => node.getLiteralText()),
];

export const inspectForbiddenAppShellActions = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  for (const sourceFile of context.project.getSourceFiles()) {
    const repoPath = getRepoSourcePath(sourceFile);
    if (!repoPath.startsWith("src/app/")) continue;
    inspectedFiles.add(repoPath);
    for (const text of appTextNodes(sourceFile)) {
      const normalizedText = text.trim();
      const forbiddenTerm = forbiddenUiTerms.find((term) => normalizedText === term);
      if (forbiddenTerm) {
        findings.push(createFinding({
          checkId: "app-shell-ui/forbidden-visible-action",
          lawId,
          filePath: repoPath,
          message: "App UI source must not expose forbidden commerce or final-selection actions.",
          evidence: forbiddenTerm,
        }));
      }
    }
    const localStorageAccess = sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .find((expression) => expression.getExpression().getText() === "localStorage");
    if (localStorageAccess) {
      findings.push(createFinding({
        checkId: "app-shell-ui/local-storage-truth-source",
        lawId,
        filePath: repoPath,
        message: "App UI must not use localStorage as production truth source.",
        evidence: localStorageAccess.getText(),
      }));
    }
    const computedVerdictIdentifier = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
      .find((identifier) => {
        const text = identifier.getText();
        return text === "computeVerdict" || text === "calculateVerdict" || text === "deriveVerdict";
      });
    if (computedVerdictIdentifier && Node.isIdentifier(computedVerdictIdentifier)) {
      findings.push(createFinding({
        checkId: "app-shell-ui/frontend-verdict-computation",
        lawId,
        filePath: repoPath,
        message: "App UI must not compute AI verdict.",
        evidence: computedVerdictIdentifier.getText(),
      }));
    }
  }
};
