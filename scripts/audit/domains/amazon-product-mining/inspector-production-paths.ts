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
  trackSourceFile,
} from "./inspector-ast-shared.js";
import { inspectProductDetailDomContract } from "./inspector-product-detail-dom-contract.js";

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
  const searchScriptImport = findNamedImportContract(
    searchFile,
    "./amazon-product-mining.search-extract-script.js",
    "buildAmazonSearchExtractScript",
  );
  const exportedSearchScriptBuilder = extractScriptFile.getExportedDeclarations().get("buildAmazonSearchExtractScript") ?? [];

  if (!runJxaImport || !hasCallToImportedFunction(searchFile, runJxaImport)) {
    findings.push(createFinding({
      checkId: "amazon-mining/search-production-jxa-call",
      lawId,
      filePath: searchRepoPath,
      message: "Amazon search extraction must call the production Chrome JXA runner that was validated against the real Amazon UAE page.",
    }));
  }

  if (hasPropertyAccessNamed(searchFile, "evaluateActiveTab")) {
    findings.push(createFinding({
      checkId: "amazon-mining/search-no-generic-evaluate-active-tab",
      lawId,
      filePath: searchRepoPath,
      message: "Amazon search extraction must not use BrowserController.evaluateActiveTab for search cards; that path was empirically rejected by production runs.",
    }));
  }

  if (!searchScriptImport || !hasCallToImportedFunction(searchFile, searchScriptImport) || exportedSearchScriptBuilder.length === 0) {
    findings.push(createFinding({
      checkId: "amazon-mining/search-extract-script-builder-contract",
      lawId,
      filePath: searchRepoPath,
      message: "Amazon search extraction must import and call the dedicated buildAmazonSearchExtractScript builder exported by the search extract script module.",
    }));
  }

  if (!hasChunkedStartIndexLoop(searchFile)) {
    findings.push(createFinding({
      checkId: "amazon-mining/search-chunked-first-page-extraction",
      lawId,
      filePath: searchRepoPath,
      message: "Amazon search extraction must keep the chunked startIndex loop so large first-page DOM payloads are collected without dropping products.",
    }));
  }
};

export const inspectChromeJxaExtractionContract = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
  repoPath: string,
  checkPrefix: string,
  subject: string,
): void => {
  const sourceFile = getRequiredSourceFile(context, repoPath);
  trackSourceFile(inspectedFiles, sourceFile);
  if (!sourceFile) {
    return;
  }

  const runJxaImport = findNamedImportContract(
    sourceFile,
    "../../lib/browser/current-chrome-window-control.js",
    "runJxa",
  );

  if (!runJxaImport || !hasCallToImportedFunction(sourceFile, runJxaImport)) {
    findings.push(createFinding({
      checkId: `amazon-mining/${checkPrefix}-production-jxa-call`,
      lawId,
      filePath: repoPath,
      message: `${subject} extraction must call the production Chrome JXA runner that was validated against the real Amazon UAE flow.`,
    }));
  }

  if (hasPropertyAccessNamed(sourceFile, "evaluateActiveTab")) {
    findings.push(createFinding({
      checkId: `amazon-mining/${checkPrefix}-no-generic-evaluate-active-tab`,
      lawId,
      filePath: repoPath,
      message: `${subject} extraction must not use BrowserController.evaluateActiveTab; production runs rejected that path with missing-value results.`,
    }));
  }

  if (!hasCallToLocalIdentifier(sourceFile, "buildChromeFrontTabJsonEvaluation")) {
    findings.push(createFinding({
      checkId: `amazon-mining/${checkPrefix}-front-tab-json-evaluation`,
      lawId,
      filePath: repoPath,
      message: `${subject} extraction must keep the Chrome front-tab JSON evaluation wrapper so returned DOM data is parseable.`,
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