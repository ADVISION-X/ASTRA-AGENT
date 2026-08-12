import type { SourceFile } from "ts-morph";

import type { InspectorContext, InspectorFinding } from "../../../shared/inspector-contracts.js";
import {
  forbidAstMarker,
  requireArrayIdentifierElement,
  requireArraySpreadElement,
  requireAstMarker,
  requireFunctionDeclaration,
  requireIdentifier,
  requireMarkerOrder,
  requireNamedImport,
} from "./deep-research-ui-ast.js";

type InspectionInput = {
  context: InspectorContext;
  findings: InspectorFinding[];
  inspectedFiles: Set<string>;
  lawId: string;
};

type InspectionFiles = {
  bootFile: SourceFile | undefined;
  clientFile: SourceFile | undefined;
  deliveryFile: SourceFile | undefined;
  panelFile: SourceFile | undefined;
  reportFile: SourceFile | undefined;
  stylesFile: SourceFile | undefined;
};

const deliveryFunctionNames = [
  "findExport",
  "renderMissingFullCaseFileDelivery",
  "renderFullCaseFileMeta",
  "renderFullCaseFileActions",
  "renderFullCaseFileOutline",
  "renderMissingPrimaryBusinessReport",
  "renderPrimaryBusinessReportContent",
  "renderFullCaseFileDelivery",
  "renderPrimaryBusinessReport",
] as const;

const reportFunctionNames = [
  "renderChainProgress",
  "renderPrimaryHtmlActions",
] as const;

const getInspectionFiles = (context: InspectorContext): InspectionFiles => ({
  bootFile: context.project.getSourceFile("src/app/workbench-deep-research-client-boot.ts"),
  clientFile: context.project.getSourceFile("src/app/workbench-deep-research-client.ts"),
  deliveryFile: context.project.getSourceFile("src/app/workbench-deep-research-client-delivery-sections.ts"),
  panelFile: context.project.getSourceFile("src/app/workbench-deep-research-panel.ts"),
  reportFile: context.project.getSourceFile("src/app/workbench-deep-research-client-report-sections.ts"),
  stylesFile: context.project.getSourceFile("src/app/workbench-deep-research-case-reader-styles.ts"),
});

const requireFunctionArrayEntry = (input: InspectionInput & {
  arrayName: string;
  checkId: string;
  functionName: string;
  sourceFile: SourceFile | undefined;
}): void => {
  requireFunctionDeclaration({ ...input });
  requireArrayIdentifierElement({
    findings: input.findings,
    inspectedFiles: input.inspectedFiles,
    sourceFile: input.sourceFile,
    lawId: input.lawId,
    checkId: input.checkId.replace("-declaration", "-array"),
    arrayName: input.arrayName,
    identifierName: input.functionName,
  });
};

const inspectRuntimeInjection = (input: InspectionInput, files: InspectionFiles): void => {
  requireNamedImport({
    ...input,
    sourceFile: files.clientFile,
    checkId: "local-app-shell/deep-research-delivery-function-import",
    symbolName: "deepResearchClientDeliverySectionFunctions",
    moduleSuffix: "./workbench-deep-research-client-delivery-sections.js",
  });
  requireIdentifier({
    ...input,
    sourceFile: files.clientFile,
    checkId: "local-app-shell/deep-research-delivery-function-injection",
    identifierName: "deepResearchClientDeliverySectionFunctions",
  });
  requireArraySpreadElement({
    ...input,
    sourceFile: files.clientFile,
    checkId: "local-app-shell/deep-research-delivery-function-array-spread",
    arrayName: "DEEP_RESEARCH_CLIENT_FUNCTIONS",
    spreadName: "deepResearchClientDeliverySectionFunctions",
  });
  requireIdentifier({
    ...input,
    sourceFile: files.bootFile,
    checkId: "local-app-shell/deep-research-export-open-function-injection",
    identifierName: "openDeepResearchExport",
  });
  requireArrayIdentifierElement({
    ...input,
    sourceFile: files.bootFile,
    checkId: "local-app-shell/deep-research-export-open-boot-array",
    arrayName: "deepResearchClientBootFunctions",
    identifierName: "openDeepResearchExport",
  });
};

const inspectBrowserFunctions = (input: InspectionInput, files: InspectionFiles): void => {
  for (const functionName of deliveryFunctionNames) {
    requireFunctionArrayEntry({
      ...input,
      sourceFile: files.deliveryFile,
      checkId: "local-app-shell/deep-research-delivery-browser-function-declaration",
      arrayName: "deepResearchClientDeliverySectionFunctions",
      functionName,
    });
  }
  for (const functionName of reportFunctionNames) {
    requireFunctionArrayEntry({
      ...input,
      sourceFile: files.reportFile,
      checkId: "local-app-shell/deep-research-report-delivery-function-declaration",
      arrayName: "deepResearchClientReportFunctions",
      functionName,
    });
  }
};

const inspectDeliveryMarkers = (input: InspectionInput, files: InspectionFiles): void => {
  for (const marker of ["sourceKind", "fileHash", "fileSizeBytes", "failureReason", "reviewReason", "Open HTML Report", "Download HTML Report"]) {
    requireAstMarker({ ...input, sourceFile: files.deliveryFile, checkId: "local-app-shell/deep-research-html-delivery-marker", marker });
  }
  for (const marker of [
    "research-chain-strip",
    "research-chain-index",
    "stage-html-report",
    "data-deep-research-open-export=\"business-report.html\"",
    "data-deep-research-export=\"business-report.html\"",
  ]) {
    requireAstMarker({ ...input, sourceFile: files.reportFile, checkId: "local-app-shell/deep-research-report-primary-delivery-marker", marker });
  }
  requireAstMarker({ ...input, sourceFile: files.stylesFile, checkId: "local-app-shell/deep-research-chain-strip-style", marker: ".research-chain-strip" });
};

const inspectReaderPrimaryLayout = (input: InspectionInput, files: InspectionFiles): void => {
  requireAstMarker({
    ...input,
    sourceFile: files.panelFile,
    checkId: "local-app-shell/deep-research-reader-primary-layout",
    marker: "reader-primary-history-library",
  });
  requireMarkerOrder({
    ...input,
    sourceFile: files.panelFile,
    checkId: "local-app-shell/deep-research-reader-before-history",
    firstSymbolName: "renderDeepResearchReportView",
    secondSymbolName: "renderDeepResearchHistoryView",
  });
};

const inspectForbiddenMarkers = (input: InspectionInput, files: InspectionFiles): void => {
  for (const marker of ["PPT", "Deck", "Optional Presentation"]) {
    forbidAstMarker({
      ...input,
      sourceFile: files.deliveryFile,
      checkId: "local-app-shell/deep-research-html-delivery-forbidden",
      marker,
    });
  }
};

export const inspectDeepResearchHtmlDeliveryStatusUi = (input: InspectionInput): void => {
  const files = getInspectionFiles(input.context);
  inspectRuntimeInjection(input, files);
  inspectBrowserFunctions(input, files);
  inspectDeliveryMarkers(input, files);
  inspectReaderPrimaryLayout(input, files);
  inspectForbiddenMarkers(input, files);
};
