import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  findNamedImportContract,
  getRequiredSourceFile,
  hasCallToImportedFunction,
  hasCallToLocalIdentifier,
  hasChunkedStartIndexLoop,
  hasIdentifier,
  hasPropertyAccessNamed,
  hasStringRawTemplateInitializer,
  trackSourceFile,
} from "./inspector-ast-shared.js";
import { inspectProductDetailDomContract } from "./inspector-product-detail-dom-contract.js";

const pushSearchBrowserContractFindings = (input: {
  findings: InspectorFinding[];
  lawId: string;
  searchFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>;
  searchRepoPath: string;
  usesRunJxa: boolean;
}): void => {
  if (!hasPropertyAccessNamed(input.searchFile, "evaluateActiveTab")) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/search-browser-controller-contract",
      lawId: input.lawId,
      filePath: input.searchRepoPath,
      message: "Amazon search extraction must use BrowserController.evaluateActiveTab so audited production code matches the acceptance browser contract.",
    }));
  }

  if (input.usesRunJxa) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/search-no-direct-jxa",
      lawId: input.lawId,
      filePath: input.searchRepoPath,
      message: "Amazon search extraction must not bypass BrowserController with direct runJxa calls.",
    }));
  }

  if (hasPropertyAccessNamed(input.searchFile, "whose")) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/search-no-jxa-whose-window-selector",
      lawId: input.lawId,
      filePath: input.searchRepoPath,
      message: "Amazon search extraction must not use JXA windows.whose selectors; production Chrome runs rejected them with invalid-index errors.",
    }));
  }
};

const pushSearchScriptContractFindings = (input: {
  extractScriptFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>;
  extractScriptRepoPath: string;
  findings: InspectorFinding[];
  lawId: string;
  searchFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>;
  searchRepoPath: string;
}): void => {
  const searchScriptImport = findNamedImportContract(
    input.searchFile,
    "./amazon-product-mining.search-extract-script.js",
    "buildAmazonSearchExtractScript",
  );
  const exportedSearchScriptBuilder = input.extractScriptFile.getExportedDeclarations().get("buildAmazonSearchExtractScript") ?? [];

  if (!searchScriptImport || !hasCallToImportedFunction(input.searchFile, searchScriptImport) || exportedSearchScriptBuilder.length === 0) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/search-extract-script-builder-contract",
      lawId: input.lawId,
      filePath: input.searchRepoPath,
      message: "Amazon search extraction must import and call the dedicated buildAmazonSearchExtractScript builder exported by the search extract script module.",
    }));
  }

  if (!hasChunkedStartIndexLoop(input.searchFile)) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/search-chunked-first-page-extraction",
      lawId: input.lawId,
      filePath: input.searchRepoPath,
      message: "Amazon search extraction must keep the chunked startIndex loop so large first-page DOM payloads are collected without dropping products.",
    }));
  }

  if (!hasStringRawTemplateInitializer(input.extractScriptFile, "AMAZON_SEARCH_EXTRACT_SCRIPT_TEMPLATE")) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/search-script-string-raw",
      lawId: input.lawId,
      filePath: input.extractScriptRepoPath,
      message: "Amazon search DOM script must use String.raw so browser-side regex and escape sequences survive Node-side construction.",
    }));
  }
};

const pushBrowserTabExtractionFindings = (input: {
  checkPrefix: string;
  filePath: string;
  findings: InspectorFinding[];
  lawId: string;
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>;
  subject: string;
  usesRunJxa: boolean;
}): void => {
  if (!hasPropertyAccessNamed(input.sourceFile, "evaluateActiveTab")) {
    input.findings.push(createFinding({
      checkId: `amazon-mining/${input.checkPrefix}-browser-controller-contract`,
      lawId: input.lawId,
      filePath: input.filePath,
      message: `${input.subject} extraction must use BrowserController.evaluateActiveTab so audited production code matches the acceptance browser contract.`,
    }));
  }

  if (input.usesRunJxa) {
    input.findings.push(createFinding({
      checkId: `amazon-mining/${input.checkPrefix}-no-direct-jxa`,
      lawId: input.lawId,
      filePath: input.filePath,
      message: `${input.subject} extraction must not bypass BrowserController with direct runJxa calls.`,
    }));
  }

  if (hasCallToLocalIdentifier(input.sourceFile, "buildChromeFrontTabJsonEvaluation")) {
    input.findings.push(createFinding({
      checkId: `amazon-mining/${input.checkPrefix}-no-front-tab-json-wrapper`,
      lawId: input.lawId,
      filePath: input.filePath,
      message: `${input.subject} extraction must not keep the direct JXA front-tab JSON wrapper once BrowserController.evaluateActiveTab is the governed path.`,
    }));
  }
};

const pushBrowserTabScriptTemplateFinding = (input: {
  checkPrefix: string;
  filePath: string;
  findings: InspectorFinding[];
  lawId: string;
  scriptVariableName: string;
  sourceFile: NonNullable<ReturnType<typeof getRequiredSourceFile>>;
  subject: string;
}): void => {
  if (!hasStringRawTemplateInitializer(input.sourceFile, input.scriptVariableName)) {
    input.findings.push(createFinding({
      checkId: `amazon-mining/${input.checkPrefix}-script-string-raw`,
      lawId: input.lawId,
      filePath: input.filePath,
      message: `${input.subject} DOM script must use String.raw so browser-side regex and escape sequences survive Node-side construction.`,
    }));
  }
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
};

export const inspectSearchExtractionProductionPath = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const searchRepoPath = "src/plugins/amazon-product-mining/amazon-product-mining.search.ts";
  const extractScriptRepoPath = "src/plugins/amazon-product-mining/amazon-product-mining.search-extract-script.ts";
  const searchFile = getRequiredSourceFile(context, searchRepoPath);
  const extractScriptFile = getRequiredSourceFile(context, extractScriptRepoPath);
  trackSourceFile(inspectedFiles, searchFile);
  trackSourceFile(inspectedFiles, extractScriptFile);

  if (!searchFile || !extractScriptFile) {
    return;
  }

  const runJxaImport = findNamedImportContract(
    searchFile,
    "../../lib/browser/current-chrome-window-control.js",
    "runJxa",
  );
  const usesRunJxa = !!runJxaImport && hasCallToImportedFunction(searchFile, runJxaImport);

  pushSearchBrowserContractFindings({
    findings,
    lawId,
    searchFile,
    searchRepoPath,
    usesRunJxa,
  });
  pushSearchScriptContractFindings({
    extractScriptFile,
    extractScriptRepoPath,
    findings,
    lawId,
    searchFile,
    searchRepoPath,
  });
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

export const inspectBrowserTabExtractionContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
  input: {
    repoPath: string;
    checkPrefix: string;
    subject: string;
    scriptVariableName: string;
  },
): void => {
  const sourceFile = getRequiredSourceFile(context, input.repoPath);
  trackSourceFile(inspectedFiles, sourceFile);
  if (!sourceFile) {
    return;
  }

  const runJxaImport = findNamedImportContract(
    sourceFile,
    "../../lib/browser/current-chrome-window-control.js",
    "runJxa",
  );
  const usesRunJxa = !!runJxaImport && hasCallToImportedFunction(sourceFile, runJxaImport);

  pushBrowserTabExtractionFindings({
    checkPrefix: input.checkPrefix,
    filePath: input.repoPath,
    findings,
    lawId,
    sourceFile,
    subject: input.subject,
    usesRunJxa,
  });
  pushBrowserTabScriptTemplateFinding({
    checkPrefix: input.checkPrefix,
    filePath: input.repoPath,
    findings,
    lawId,
    scriptVariableName: input.scriptVariableName,
    sourceFile,
    subject: input.subject,
  });
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
    return;
  }

  findings.push(createFinding({
    checkId: "amazon-mining/reviews-per-page-persistence",
    lawId,
    filePath: repoPath,
    message: "reviews.ts must persist reviews per page inside pagination loop via onPageExtracted callback (law 007).",
  }));
};

export const inspectProductDetailDomFallbacks = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts";
  const detailFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, detailFile);
  inspectProductDetailDomContract({
    sourceFile: detailFile,
    findings,
    lawId,
    filePath: repoPath,
  });
};
