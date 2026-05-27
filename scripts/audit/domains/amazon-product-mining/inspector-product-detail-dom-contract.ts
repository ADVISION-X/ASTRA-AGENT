import { SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

const REQUIRED_DETAIL_DOM_TOKENS = [
  "corePrice_feature_div",
  "out of 5 stars",
  "total-review-count",
  "cr-summarization-attributes",
  "productDetails_feature_div",
  "data-a-hires",
  "sortedDimValuesForAllDims",
  "desktop-twister-sort-filter-data",
  "dimensionValueDisplayText",
  "dimensionValueState",
] as const;

const REQUIRED_DETAIL_DOM_IDENTIFIERS = [
  "cleanVisibleText",
  "collectImageUrls",
  "aPlusImageUrls",
  "serializeStarDistribution",
  "serializeTwisterVariationOptions",
  "normalizeVariationDimensionName",
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
  const literalText = [
    ...input.sourceFile.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()),
    ...input.sourceFile.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((node) => node.getLiteralText()),
    ...input.sourceFile.getDescendantsOfKind(SyntaxKind.TemplateHead).map((node) => node.getLiteralText()),
    ...input.sourceFile.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((node) => node.getLiteralText()),
    ...input.sourceFile.getDescendantsOfKind(SyntaxKind.TemplateTail).map((node) => node.getLiteralText()),
  ].join("\n");
  const identifierText = input.sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
    .map((node) => node.getText())
    .join("\n");
  const missingTokens = REQUIRED_DETAIL_DOM_TOKENS.filter((token) => !literalText.includes(token));
  const missingIdentifiers = REQUIRED_DETAIL_DOM_IDENTIFIERS
    .filter((identifier) => !literalText.includes(identifier) && !identifierText.includes(identifier));
  if (missingTokens.length === 0 && missingIdentifiers.length === 0) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "amazon-mining/detail-dom-fallback-contract",
    lawId: input.lawId,
    filePath: input.filePath,
    message: "amazon-product-mining.product-detail.ts must keep fallback selectors for visible detail price/rating/review count extraction.",
    evidence: `missingTokens=${missingTokens.join(",")};missingIdentifiers=${missingIdentifiers.join(",")}`,
  }));
};
