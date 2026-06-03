import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { hasIdentifier } from "./inspector-ast-shared.js";

const sourceExports = (sourceFile: SourceFile, exportName: string): boolean =>
  sourceFile.getExportedDeclarations().has(exportName);

const objectHasRouteKey = (sourceFile: SourceFile, routeKey: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression).some((objectLiteral) =>
    objectLiteral.getProperties().some((property) => {
      if (!Node.isPropertyAssignment(property)) return false;
      const nameNode = property.getNameNode();
      return Node.isStringLiteral(nameNode) && nameNode.getLiteralValue() === routeKey;
    }),
  );

const routeRuleArrayHasPath = (sourceFile: SourceFile, path: string): boolean =>
  sourceFile.getDescendantsOfKind(SyntaxKind.ArrayLiteralExpression).some((arrayLiteral) =>
    arrayLiteral.getElements().some((element) => {
      if (!Node.isObjectLiteralExpression(element)) return false;
      const pathProperty = element.getProperty("path");
      if (!Node.isPropertyAssignment(pathProperty)) return false;
      const initializer = pathProperty.getInitializer();
      return Node.isStringLiteral(initializer) && initializer.getLiteralValue() === path;
    }),
  );

export const inspectKeywordReviewAutomationOnlyGuards = (input: {
  findings: InspectorFinding[];
  lawId: string;
  keywordReviewFile: SourceFile | undefined;
  pluginIndexFile: SourceFile | undefined;
  routesFile: SourceFile | undefined;
  apiBoundaryFile: SourceFile | undefined;
  schemaFile: SourceFile | undefined;
}): void => {
  const violations: string[] = [];
  if (input.keywordReviewFile && sourceExports(input.keywordReviewFile, "ingestManualKeywordOpportunityReview")) {
    violations.push("keyword-review-manual-ingest-export");
  }
  if (input.pluginIndexFile && sourceExports(input.pluginIndexFile, "ingestAmazonProductMiningKeywordReview")) {
    violations.push("plugin-manual-ingest-export");
  }
  if (input.routesFile && objectHasRouteKey(input.routesFile, "POST:/api/amazon-product-mining/keyword-review/manual-ingest")) {
    violations.push("manual-ingest-route");
  }
  if (input.apiBoundaryFile && routeRuleArrayHasPath(input.apiBoundaryFile, "/api/amazon-product-mining/keyword-review/manual-ingest")) {
    violations.push("manual-ingest-api-boundary-rule");
  }
  if (input.schemaFile && hasIdentifier(input.schemaFile, "AmazonKeywordOpportunityManualIngestSchema")) {
    violations.push("manual-ingest-schema");
  }
  if (violations.length === 0) return;

  input.findings.push(createFinding({
    checkId: "amazon-mining/keyword-review-automation-only",
    lawId: input.lawId,
    filePath: "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review.ts",
    message: "Keyword opportunity review must be automated-only: no manual ingest export, route, API boundary rule, or schema is allowed.",
    evidence: `violations=${violations.join(",")}`,
  }));
};
