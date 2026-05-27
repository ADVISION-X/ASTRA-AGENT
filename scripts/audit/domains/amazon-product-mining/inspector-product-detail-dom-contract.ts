import type { SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

const REQUIRED_DETAIL_DOM_TOKENS = [
  "corePrice_feature_div",
  "out of 5 stars",
  "total-review-count",
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
  const sourceText = input.sourceFile.getFullText();
  const missingTokens = REQUIRED_DETAIL_DOM_TOKENS.filter((token) => !sourceText.includes(token));
  if (missingTokens.length === 0) {
    return;
  }
  input.findings.push(createFinding({
    checkId: "amazon-mining/detail-dom-fallback-contract",
    lawId: input.lawId,
    filePath: input.filePath,
    message: "amazon-product-mining.product-detail.ts must keep fallback selectors for visible detail price/rating/review count extraction.",
    evidence: `missing=${missingTokens.join(",")}`,
  }));
};