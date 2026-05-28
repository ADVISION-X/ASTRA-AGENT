import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  fileIncludesText,
  getRequiredSourceFile,
  hasCallToLocalIdentifier,
  hasIdentifier,
  trackSourceFile,
} from "./inspector-ast-shared.js";

const exportedRangeHasBounds = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  variableName: string,
  expectedMin: number,
  expectedMax: number,
): boolean => {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const rawInitializer = declaration?.getInitializer();
  const objectLiteral = Node.isObjectLiteralExpression(rawInitializer)
    ? rawInitializer
    : Node.isAsExpression(rawInitializer)
      ? rawInitializer.getExpressionIfKind(SyntaxKind.ObjectLiteralExpression)
      : undefined;
  if (!objectLiteral) {
    return false;
  }
  const minProperty = objectLiteral.getProperty("min");
  const maxProperty = objectLiteral.getProperty("max");
  if (!Node.isPropertyAssignment(minProperty) || !Node.isPropertyAssignment(maxProperty)) {
    return false;
  }
  const minInitializer = minProperty.getInitializerIfKind(SyntaxKind.NumericLiteral);
  const maxInitializer = maxProperty.getInitializerIfKind(SyntaxKind.NumericLiteral);
  return minInitializer?.getLiteralValue() === expectedMin
    && maxInitializer?.getLiteralValue() === expectedMax;
};

export const inspectFlowSearchBeforeDetail = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts";
  const flowFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, flowFile);
  if (!flowFile) {
    return;
  }

  const text = flowFile.getFullText();
  const lastFromIdx = Math.max(text.lastIndexOf("from '"), text.lastIndexOf('from "'));
  const bodyStart = lastFromIdx > 0 ? lastFromIdx : 0;
  const persistSearchIdx = text.indexOf("persistSearchResults", bodyStart);
  const productDetailOpenIdx = text.indexOf("runProductDetailExtraction(", bodyStart);

  if (persistSearchIdx < 0 || productDetailOpenIdx < 0) {
    findings.push(createFinding({
      checkId: "amazon-mining/search-before-detail",
      lawId,
      filePath: repoPath,
      message: "flow.ts must call persistSearchResults before runProductDetailExtraction (law 005).",
    }));
    return;
  }

  if (persistSearchIdx > productDetailOpenIdx) {
    findings.push(createFinding({
      checkId: "amazon-mining/search-persist-before-detail",
      lawId,
      filePath: repoPath,
      message: "persistSearchResults must appear before runProductDetailExtraction in flow.ts (law 005).",
    }));
  }

  const requiredTopRankIdentifiers = [
    "AMAZON_PRODUCT_MINING_DETAIL_RANK_LIMIT",
    "selectSearchItemsForDetailMining",
  ] as const;
  const missingTopRankIdentifiers = requiredTopRankIdentifiers.filter((identifier) => !hasIdentifier(flowFile, identifier));
  if (missingTopRankIdentifiers.length > 0) {
    findings.push(createFinding({
      checkId: "amazon-mining/detail-mining-top-30-rank-limit",
      lawId,
      filePath: repoPath,
      message: "flow.ts must keep the governed top-30 search-rank limit for product detail and review mining while preserving all search results.",
      evidence: `missingIdentifiers=${missingTopRankIdentifiers.join(",")}`,
    }));
  }
};

export const inspectAmazonHumanPacingDelay = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts";
  const flowFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, flowFile);
  if (!flowFile) {
    return;
  }
  const requiredIdentifiers = [
    "AMAZON_PRODUCT_DETAIL_OPEN_DELAY_MS_RANGE",
    "AMAZON_REVIEW_PAGE_OPEN_DELAY_MS_RANGE",
    "selectAmazonMiningPacingDelayMs",
    "waitForProductDetailOpenPacingDelay",
    "waitForReviewPageOpenPacingDelay",
  ] as const;
  const missingIdentifiers = requiredIdentifiers.filter((identifier) => !hasIdentifier(flowFile, identifier));
  if (
    missingIdentifiers.length === 0
    && hasCallToLocalIdentifier(flowFile, "waitForProductDetailOpenPacingDelay")
    && hasCallToLocalIdentifier(flowFile, "waitForReviewPageOpenPacingDelay")
    && exportedRangeHasBounds(flowFile, "AMAZON_PRODUCT_DETAIL_OPEN_DELAY_MS_RANGE", 1_000, 60_000)
    && exportedRangeHasBounds(flowFile, "AMAZON_REVIEW_PAGE_OPEN_DELAY_MS_RANGE", 1_000, 20_000)
  ) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/human-pacing-delay",
    lawId,
    filePath: repoPath,
    message: "flow.ts must enforce governed random pacing before product detail opens and review page opens.",
    evidence: `missingIdentifiers=${missingIdentifiers.join(",")}`,
  }));
};

export const inspectRejectedKeywordEvidencePurge = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const contracts = [
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts",
      requiredIdentifiers: [
        "purgeRejectedKeywordEvidence",
        "purgeRejectedKeywordReviewEvidenceArtifacts",
        "rejected_keyword_evidence_purged",
      ],
    },
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.storage.ts",
      requiredIdentifiers: [
        "purgeRejectedKeywordEvidence",
        "amazon_mining_search_results",
        "amazon_mining_search_result_product_link",
        "amazon_mining_product_details",
        "amazon_mining_reviews",
        "amazon_mining_exception_records",
      ],
    },
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts",
      requiredIdentifiers: [
        "purgeRejectedKeywordReviewEvidenceArtifacts",
        "unlinkSync",
      ],
    },
  ] as const;

  for (const contract of contracts) {
    const sourceFile = getRequiredSourceFile(context, contract.repoPath);
    trackSourceFile(inspectedFiles, sourceFile);
    if (!sourceFile) {
      continue;
    }
    const missingIdentifiers = contract.requiredIdentifiers.filter((identifier) => !fileIncludesText(sourceFile, identifier));
    if (missingIdentifiers.length === 0) {
      continue;
    }
    findings.push(createFinding({
      checkId: "amazon-mining/rejected-keyword-evidence-purge",
      lawId,
      filePath: contract.repoPath,
      message: "REJECT keyword reviews must physically purge keyword-owned bulk evidence while preserving only a verdict tombstone.",
      evidence: `missingIdentifiers=${missingIdentifiers.join(",")}`,
    }));
  }
};

const sourceHasCallExpression = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  identifier: string,
): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
  .some((callExpression) => callExpression.getExpression().getText() === identifier);

const exportedFunctionHasStartsWithPolicy = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
): boolean => {
  const declarations = sourceFile.getExportedDeclarations().get("canContinueAfterWebChatSourceRestoreFailure") ?? [];
  return declarations.some((declaration) =>
    declaration.getDescendantsOfKind(SyntaxKind.CallExpression).some((callExpression) => {
      const expression = callExpression.getExpression();
      if (!Node.isPropertyAccessExpression(expression)) {
        return false;
      }
      const callTargetIsStartsWith = expression.getName() === "startsWith";
      const receiverIsPromptContract = expression.getExpression().getText().endsWith("promptContractId");
      const firstArgument = callExpression.getArguments()[0];
      const argumentIsAmazonPrefix = Node.isIdentifier(firstArgument)
        && firstArgument.getText() === "AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX";
      return callTargetIsStartsWith && receiverIsPromptContract && argumentIsAmazonPrefix;
    }));
};

export const inspectAmazonWebChatRestoreContinuity = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const policyPath = "src/capabilities/ai-input-gateway/providers/web-chat-restore-policy.ts";
  const sharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
  const runtimePath = "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts";
  const acceptancePath = "scripts/acceptance/amazon-product-mining-web-chat-restore.acceptance.ts";
  const policyFile = getRequiredSourceFile(context, policyPath);
  const sharedFile = getRequiredSourceFile(context, sharedPath);
  const runtimeFile = getRequiredSourceFile(context, runtimePath);
  const acceptanceFile = getRequiredSourceFile(context, acceptancePath);
  trackSourceFile(inspectedFiles, policyFile);
  trackSourceFile(inspectedFiles, sharedFile);
  trackSourceFile(inspectedFiles, runtimeFile);
  trackSourceFile(inspectedFiles, acceptanceFile);

  const policyOk = policyFile
    ? hasIdentifier(policyFile, "AMAZON_PRODUCT_MINING_PROMPT_CONTRACT_PREFIX")
      && exportedFunctionHasStartsWithPolicy(policyFile)
    : false;
  const sharedOk = sharedFile
    ? hasIdentifier(sharedFile, "restoredSourcePage")
      && sourceHasCallExpression(sharedFile, "canContinueAfterWebChatSourceRestoreFailure")
    : false;
  const runtimeOk = runtimeFile
    ? hasIdentifier(runtimeFile, "buildRestoreFailure")
      && sourceHasCallExpression(runtimeFile, "canContinueAfterWebChatSourceRestoreFailure")
    : false;

  if (policyOk && sharedOk && runtimeOk && acceptanceFile && fileIncludesText(acceptanceFile, "deep-research.final-adjudication-v1")) {
    return;
  }

  findings.push(createFinding({
    checkId: "amazon-mining/web-chat-restore-continuity",
    lawId,
    filePath: policyPath,
    message: "Amazon GPT Web Chat feeds must continue after captured output when only source tab restoration failed, while non-Amazon contracts still fail closed.",
    evidence: `policyOk=${String(policyOk)} sharedOk=${String(sharedOk)} runtimeOk=${String(runtimeOk)}`,
  }));
};

export const inspectGptWebChatIsolationForKeywordMining = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/capabilities/ai-input-gateway/providers/web-chat-open.ts";
  const sourceFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, sourceFile);
  if (!sourceFile) {
    return;
  }

  if (!hasIdentifier(sourceFile, "isAmazonProductMiningGptRequest")) {
    findings.push(createFinding({
      checkId: "amazon-mining/gpt-web-chat-amazon-isolation-classifier",
      lawId,
      filePath: repoPath,
      message: "GPT Web Chat opening logic must classify Amazon keyword mining requests for isolated ChatGPT conversations.",
    }));
  }

  const freshConversationDeclaration = sourceFile.getVariableDeclaration("requiresFreshChatGptConversation");
  const freshConversationInitializer = freshConversationDeclaration?.getInitializerIfKind(SyntaxKind.ArrowFunction);
  const freshConversationUsesAmazonClassifier = freshConversationInitializer
    ?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((callExpression) =>
      Node.isIdentifier(callExpression.getExpression())
      && callExpression.getExpression().getText() === "isAmazonProductMiningGptRequest",
    ) ?? false;

  if (!freshConversationUsesAmazonClassifier) {
    findings.push(createFinding({
      checkId: "amazon-mining/gpt-web-chat-amazon-fresh-conversation",
      lawId,
      filePath: repoPath,
      message: "Amazon keyword mining through GPT Web Chat must require a fresh ChatGPT conversation to avoid cross-task answer contamination.",
    }));
  }
};

export const inspectReviewsPerPagePersistence = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.reviews.ts";
  const reviewsFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, reviewsFile);
  if (!reviewsFile) {
    return;
  }

  const hasOnPageExtracted = hasIdentifier(reviewsFile, "onPageExtracted");
  const hasWhileLoop = reviewsFile.getDescendantsOfKind(SyntaxKind.WhileStatement).length > 0;
  if (hasOnPageExtracted && hasWhileLoop) {
    const requiredIdentifiers = [
      "buildReviewPageUrl",
      "detectReviewLanguage",
      "isEvidenceMediaUrl",
      "extractReviewRegion",
    ] as const;
    const missingIdentifiers = requiredIdentifiers
      .filter((identifier) => !fileIncludesText(reviewsFile, identifier));
    if (missingIdentifiers.length === 0) {
      return;
    }
    findings.push(createFinding({
      checkId: "amazon-mining/reviews-visible-evidence-contract",
      lawId,
      filePath: repoPath,
      message: "reviews.ts must keep governed review URL pagination, per-review language detection, region parsing, and media URL filtering.",
      evidence: `missingIdentifiers=${missingIdentifiers.join(",")}`,
    }));
    return;
  }

  findings.push(createFinding({
    checkId: "amazon-mining/reviews-per-page-persistence",
    lawId,
    filePath: repoPath,
    message: "reviews.ts must persist reviews per page inside pagination loop via onPageExtracted callback (law 007).",
  }));
};

export const inspectPackageEvidenceDepthContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const contracts = [
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.package.ts",
      requiredTexts: ["aPlusImageUrls", "starDistribution", "fieldDisclosures"],
    },
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.package-product-evidence.ts",
      requiredTexts: ["aPlusImageUrls", "a_plus_image", "fieldDisclosures"],
    },
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.package-review-evidence.ts",
      requiredTexts: ["fieldDisclosureMap", "reviewLanguage", "reviewRegionIfVisible"],
    },
    {
      repoPath: "src/plugins/amazon-product-mining/amazon-product-mining.package-completeness.ts",
      requiredTexts: ["aPlusImageUrls", "a_plus_image"],
    },
  ] as const;

  for (const contract of contracts) {
    const sourceFile = getRequiredSourceFile(context, contract.repoPath);
    trackSourceFile(inspectedFiles, sourceFile);
    if (!sourceFile) {
      continue;
    }
    const missingTexts = contract.requiredTexts.filter((text) => !fileIncludesText(sourceFile, text));
    if (missingTexts.length === 0) {
      continue;
    }
    findings.push(createFinding({
      checkId: "amazon-mining/package-evidence-depth-contract",
      lawId,
      filePath: contract.repoPath,
      message: "Amazon package artifacts must carry deep detail, A+ image, review disclosure, and field-reason evidence into the advanced-AI readable package.",
      evidence: `missingTexts=${missingTexts.join(",")}`,
    }));
  }
};
