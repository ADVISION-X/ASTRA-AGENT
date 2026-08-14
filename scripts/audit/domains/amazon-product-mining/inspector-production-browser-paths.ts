import { Node, SyntaxKind } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import {
  findNamedImportContract,
  getRequiredSourceFile,
  hasCallToImportedFunction,
  hasCallToLocalIdentifier,
  hasChunkedStartIndexLoop,
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
  if (!hasPropertyAccessNamed(input.searchFile, "evaluate")) {
    input.findings.push(createFinding({
      checkId: "amazon-mining/search-browser-controller-contract",
      lawId: input.lawId,
      filePath: input.searchRepoPath,
      message: "Amazon search extraction must use BrowserTargetSession.evaluate so audited production code matches the exact-target contract.",
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
  if (!hasPropertyAccessNamed(input.sourceFile, "evaluate")) {
    input.findings.push(createFinding({
      checkId: `amazon-mining/${input.checkPrefix}-browser-controller-contract`,
      lawId: input.lawId,
      filePath: input.filePath,
      message: `${input.subject} extraction must use BrowserTargetSession.evaluate so audited production code matches the exact-target contract.`,
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
      message: `${input.subject} extraction must not keep the direct JXA front-tab JSON wrapper once BrowserTargetSession.evaluate is the governed path.`,
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

  pushSearchBrowserContractFindings({ findings, lawId, searchFile, searchRepoPath, usesRunJxa });
  pushSearchScriptContractFindings({
    extractScriptFile,
    extractScriptRepoPath,
    findings,
    lawId,
    searchFile,
    searchRepoPath,
  });
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
    extractScriptImportPath?: string;
    extractScriptRepoPath?: string;
  },
): void => {
  const sourceFile = getRequiredSourceFile(context, input.repoPath);
  trackSourceFile(inspectedFiles, sourceFile);
  if (!sourceFile) {
    return;
  }
  const extractScriptFile = input.extractScriptRepoPath
    ? getRequiredSourceFile(context, input.extractScriptRepoPath)
    : sourceFile;
  trackSourceFile(inspectedFiles, extractScriptFile);

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
  if (input.extractScriptImportPath && input.extractScriptRepoPath) {
    const scriptImport = findNamedImportContract(sourceFile, input.extractScriptImportPath, input.scriptVariableName);
    if (!scriptImport || !extractScriptFile) {
      findings.push(createFinding({
        checkId: `amazon-mining/${input.checkPrefix}-extract-script-import-contract`,
        lawId,
        filePath: input.repoPath,
        message: `${input.subject} extraction must import ${input.scriptVariableName} from the dedicated owner-local DOM script module.`,
      }));
      return;
    }
  }
  if (!extractScriptFile) {
    return;
  }
  pushBrowserTabScriptTemplateFinding({
    checkPrefix: input.checkPrefix,
    filePath: input.extractScriptRepoPath ?? input.repoPath,
    findings,
    lawId,
    scriptVariableName: input.scriptVariableName,
    sourceFile: extractScriptFile,
    subject: input.subject,
  });
};

export const inspectProductDetailDomFallbacks = (
  context: InspectorContext,
  findings: InspectorFinding[],
  inspectedFiles: Set<string>,
  lawId: string,
): void => {
  const repoPath = "src/plugins/amazon-product-mining/amazon-product-mining.product-detail.ts";
  const detailScriptRepoPath = "src/plugins/amazon-product-mining/amazon-product-mining.product-detail-script.ts";
  const detailFile = getRequiredSourceFile(context, repoPath);
  const detailScriptFile = getRequiredSourceFile(context, detailScriptRepoPath);
  trackSourceFile(inspectedFiles, detailFile);
  trackSourceFile(inspectedFiles, detailScriptFile);
  const detailScriptImport = detailFile
    ? findNamedImportContract(detailFile, "./amazon-product-mining.product-detail-script.js", "AMAZON_DETAIL_EXTRACT_SCRIPT")
    : undefined;
  inspectProductDetailDomContract({
    sourceFile: detailScriptImport && detailScriptFile ? detailScriptFile : detailFile,
    findings,
    lawId,
    filePath: detailScriptImport && detailScriptFile ? detailScriptRepoPath : repoPath,
  });
};
