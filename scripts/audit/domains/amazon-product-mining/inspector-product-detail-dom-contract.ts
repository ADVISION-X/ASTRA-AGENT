import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

const REQUIRED_DETAIL_DOM_LITERALS = [
  "#corePrice_feature_div .a-price .a-offscreen",
  "out of 5 stars",
  "[data-hook=\"total-review-count\"]",
  "[data-hook=\"cr-summarization-attributes\"]",
  "#productOverview_feature_div tr",
  "data-a-hires",
  "sortedDimValuesForAllDims",
  "desktop-twister-sort-filter-data",
] as const;

const REQUIRED_DETAIL_DOM_IDENTIFIERS = [
  "cleanVisibleText",
  "collectImageUrls",
  "aPlusImageUrls",
  "serializeStarDistribution",
  "serializeTwisterVariationOptions",
  "normalizeVariationDimensionName",
  "dimensionValueDisplayText",
  "dimensionValueState",
] as const;

export const inspectProductDetailDomContract = (input: {
  sourceFile: SourceFile | undefined;
  findings: InspectorFinding[];
  lawId: string;
  filePath: string;
}): void => {
  if (!input.sourceFile) {
    return;
  }
  const scriptDeclaration = input.sourceFile.getVariableDeclaration("AMAZON_DETAIL_EXTRACT_SCRIPT");
  const taggedTemplate = scriptDeclaration?.getInitializerIfKind(SyntaxKind.TaggedTemplateExpression);
  const template = taggedTemplate?.getTemplate();
  const embeddedScript = Node.isNoSubstitutionTemplateLiteral(template) ? template.getLiteralText() : null;
  const embeddedSource = embeddedScript === null ? undefined : new Project({ useInMemoryFileSystem: true })
    .createSourceFile("amazon-product-detail-script.js", embeddedScript);
  if (!embeddedSource) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/detail-dom-fallback-contract",
      lawId: input.lawId,
      filePath: input.filePath,
      message: "Amazon detail extraction must remain one AST-parseable embedded script.",
    }));
    return;
  }
  const literalValues = new Set([
    ...embeddedSource.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
    ...embeddedSource.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
  ]);
  const identifierValues = new Set(embeddedSource.getDescendantsOfKind(SyntaxKind.Identifier)
    .map((node) => node.getText()));
  const missingLiterals = REQUIRED_DETAIL_DOM_LITERALS.filter((literal) =>
    ![...literalValues].some((value) => value.includes(literal)));
  const missingIdentifiers = REQUIRED_DETAIL_DOM_IDENTIFIERS.filter((identifier) => !identifierValues.has(identifier));
  if (missingLiterals.length === 0 && missingIdentifiers.length === 0) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "amazon-mining/detail-dom-fallback-contract",
    lawId: input.lawId,
    filePath: input.filePath,
    message: "amazon-product-mining.product-detail.ts must keep fallback selectors for visible detail price/rating/review count extraction.",
    evidence: `missingLiterals=${missingLiterals.join(",")};missingIdentifiers=${missingIdentifiers.join(",")}`,
  }));
};
