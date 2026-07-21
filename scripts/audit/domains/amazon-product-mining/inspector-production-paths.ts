import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  fileIncludesText,
  getRequiredSourceFile,
  hasCallToLocalIdentifier,
  hasIdentifier,
  hasStringLiteral,
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

const firstCallStartByName = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  callName: string,
): number | null => {
  const starts = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .flatMap((callExpression) => {
      const expression = callExpression.getExpression();
      const matches = Node.isIdentifier(expression)
        ? expression.getText() === callName
        : Node.isPropertyAccessExpression(expression) && expression.getName() === callName;
      return matches ? [callExpression.getStart()] : [];
    });
  return starts.length > 0 ? Math.min(...starts) : null;
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

  const persistSearchIdx = firstCallStartByName(flowFile, "persistSearchResults");
  const productDetailOpenIdx = firstCallStartByName(flowFile, "runProductDetailExtraction");

  if (persistSearchIdx === null || productDetailOpenIdx === null) {
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
    && exportedRangeHasBounds(flowFile, "AMAZON_PRODUCT_DETAIL_OPEN_DELAY_MS_RANGE", 1_000, 20_000)
    && exportedRangeHasBounds(flowFile, "AMAZON_REVIEW_PAGE_OPEN_DELAY_MS_RANGE", 1_000, 5_000)
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

const readonlyArrayLiteralContains = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  variableName: string,
  values: readonly string[],
): boolean => {
  const declaration = sourceFile.getVariableDeclaration(variableName);
  const initializer = declaration?.getInitializer();
  const arrayLiteral = Node.isArrayLiteralExpression(initializer)
    ? initializer
    : Node.isAsExpression(initializer)
      ? initializer.getExpressionIfKind(SyntaxKind.ArrayLiteralExpression)
      : undefined;
  if (!arrayLiteral) {
    return false;
  }
  const literalValues = new Set(arrayLiteral.getElements().flatMap((element) =>
    Node.isStringLiteral(element) ? [element.getLiteralValue()] : [],
  ));
  return values.every((value) => literalValues.has(value));
};

export const inspectNeutralKeywordGenerationPrompt = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.keyword.ts";
  const keywordFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, keywordFile);
  if (!keywordFile) {
    return;
  }
  const requiredIdentifiers = [
    "AMAZON_KEYWORD_GENERATION_NEUTRALITY_POLICY",
    "AMAZON_KEYWORD_GENERATION_CHINA_SUPPLIER_POLICY",
    "AMAZON_KEYWORD_GENERATION_FORBIDDEN_SYSTEM_ASSUMPTIONS",
  ] as const;
  const missingIdentifiers = requiredIdentifiers.filter((identifier) => !hasIdentifier(keywordFile, identifier));
  if (
    missingIdentifiers.length === 0
    && hasStringLiteral(keywordFile, "The system only supplies marketplace, market, user product direction, deduplication data, and JSON format rules; it must not add product traits or sourcing assumptions.")
    && hasStringLiteral(keywordFile, "If the user mentions China suppliers, treat it only as sourcing background and do not narrow keywords to small, lightweight, compact, low-volume, or easy-to-ship products unless the user explicitly wrote that constraint.")
    && readonlyArrayLiteralContains(keywordFile, "AMAZON_KEYWORD_GENERATION_FORBIDDEN_SYSTEM_ASSUMPTIONS", ["size", "weight", "small", "lightweight", "compact", "easy-to-ship"])
  ) {
    return;
  }
  findings.push(createFinding({
    checkId: "amazon-mining/neutral-keyword-generation-prompt",
    lawId,
    filePath: repoPath,
    message: "Keyword generation prompt must remain neutral: only format/dedup constraints are system-owned, and China supplier context must not inject size or shipping assumptions.",
    evidence: `missingIdentifiers=${missingIdentifiers.join(",")}`,
  }));
};

export const inspectRejectedKeywordEvidenceRetention = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const flowPath = "src/plugins/amazon-product-mining/amazon-product-mining.flow.ts";
  const storagePath = "src/plugins/amazon-product-mining/amazon-product-mining.storage.ts";
  const supportPath = "src/plugins/amazon-product-mining/amazon-product-mining.keyword-review-support.ts";
  const flowFile = getRequiredSourceFile(context, flowPath);
  const storageFile = getRequiredSourceFile(context, storagePath);
  const supportFile = getRequiredSourceFile(context, supportPath);
  for (const sourceFile of [flowFile, storageFile, supportFile]) {
    trackSourceFile(inspectedFiles, sourceFile);
  }

  const flowRetainsEvidence = flowFile
    && hasIdentifier(flowFile, "persistRejectedKeywordRetentionNote")
    && fileIncludesText(flowFile, "rejected_keyword_evidence_retained")
    && !sourceHasCallExpression(flowFile, "purgeRejectedKeywordEvidence")
    && !sourceHasCallExpression(flowFile, "purgeRejectedKeywordReviewEvidenceArtifacts");
  const storageHasNoPurgeApi = storageFile
    && !hasIdentifier(storageFile, "purgeRejectedKeywordEvidence")
    && !fileIncludesText(storageFile, "DELETE FROM amazon_mining_search_results")
    && !fileIncludesText(storageFile, "DELETE FROM amazon_mining_reviews");
  const supportHasNoArtifactDeletion = supportFile
    && !hasIdentifier(supportFile, "purgeRejectedKeywordReviewEvidenceArtifacts")
    && !hasIdentifier(supportFile, "unlinkSync");

  if (!flowRetainsEvidence || !storageHasNoPurgeApi || !supportHasNoArtifactDeletion) {
    findings.push(createFinding({
      checkId: "amazon-mining/rejected-keyword-evidence-retention",
      lawId,
      filePath: flowPath,
      message: "REJECT keyword reviews must retain a reviewable keyword evidence chain and must not call storage or artifact deletion paths.",
      evidence: `flowRetainsEvidence=${Boolean(flowRetainsEvidence)};storageHasNoPurgeApi=${Boolean(storageHasNoPurgeApi)};supportHasNoArtifactDeletion=${Boolean(supportHasNoArtifactDeletion)}`,
    }));
  }
};

const sourceHasCallExpression = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  identifier: string,
): boolean => sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
  .some((callExpression) => {
    const expression = callExpression.getExpression();
    return expression.getText() === identifier
      || (Node.isPropertyAccessExpression(expression) && expression.getName() === identifier);
  });

const exportedFunctionHasStartsWithPolicy = (
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>,
  exportedFunctionName = "canContinueAfterWebChatSourceRestoreFailure",
): boolean => {
  const declarations = sourceFile.getExportedDeclarations().get(exportedFunctionName) ?? [];
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
  const openPath = "src/capabilities/ai-input-gateway/providers/web-chat-open.ts";
  const sharedPath = "src/capabilities/ai-input-gateway/providers/web-chat-shared.ts";
  const runtimePath = "src/capabilities/ai-input-gateway/runtime/feed-provider-once.ts";
  const acceptancePath = "scripts/acceptance/amazon-product-mining-web-chat-restore.acceptance.ts";
  const openFile = getRequiredSourceFile(context, openPath);
  const sharedFile = getRequiredSourceFile(context, sharedPath);
  const runtimeFile = getRequiredSourceFile(context, runtimePath);
  const acceptanceFile = getRequiredSourceFile(context, acceptancePath);
  trackSourceFile(inspectedFiles, openFile);
  trackSourceFile(inspectedFiles, sharedFile);
  trackSourceFile(inspectedFiles, runtimeFile);
  trackSourceFile(inspectedFiles, acceptanceFile);

  const openOk = openFile
    ? exportedFunctionHasStartsWithPolicy(openFile, "isAmazonProductMiningGptRequest")
    : false;
  const sharedOk = sharedFile
    ? hasIdentifier(sharedFile, "restoredSourcePage")
      && fileIncludesText(sharedFile, "SOURCE_PAGE_RESTORE_FAILED")
      && fileIncludesText(sharedFile, "transportWarnings")
      && sourceHasCallExpression(sharedFile, "closeActiveTab")
    : false;
  const runtimeOk = runtimeFile
    ? !sourceHasCallExpression(runtimeFile, "canContinueAfterWebChatSourceRestoreFailure")
      && !fileIncludesText(runtimeFile, "buildRestoreFailure")
    : false;

  if (openOk && sharedOk && runtimeOk && acceptanceFile && fileIncludesText(acceptanceFile, "deep-research.final-adjudication-v1")) {
    return;
  }

  findings.push(createFinding({
    checkId: "amazon-mining/web-chat-restore-continuity",
    lawId,
    filePath: sharedPath,
    message: "Every captured GPT Web Chat response must survive source-tab restoration failure; prompt-contract exception lists are forbidden.",
    evidence: `openOk=${String(openOk)} sharedOk=${String(sharedOk)} runtimeOk=${String(runtimeOk)}`,
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
