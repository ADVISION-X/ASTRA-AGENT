import { existsSync } from "node:fs";

import {
  Node,
  Project,
  SyntaxKind,
  type ArrayLiteralExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";

import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { type InspectorContext, type InspectorFinding, type InspectorOutput, type SessionInspectorOutput } from "../../shared/inspector-contracts.js";
import { inspectPluginInterventionContract } from "../../shared/plugin-intervention-contract-inspector.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";
import { inspectAmazonInvoiceAmountGate } from "./inspector-amount-gate.js";
import { inspectAmazonInvoiceBatchGuard } from "./inspector-batch.js";
import { inspectDownloadFlow } from "./inspector-download-flow.js";
import { inspectAmazonInvoiceUploadLedgerGuard } from "./inspector-ledger.js";
import { inspectUploadRouteSanitizer } from "./inspector-upload-route-sanitizer.js";
import { inspectUploadStabilityGuard } from "./inspector-upload-stability.js";

const domain = "amazon-invoice-upload";
const lawPath = ".github/instructions/agent-rules/modules/module-amazon-invoice-upload.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md";
const processPath = "docs/法案辅助文件/amazon_invoice_upload_process.md";
const ownerRoot = "src/plugins/amazon-invoice-upload";
const missionSchemaPath = `${ownerRoot}/mission.schema.ts`;
const uploadFlowPath = `${ownerRoot}/amazon-invoice-upload.flow.ts`;
const uploadFlowSupportPath = `${ownerRoot}/amazon-invoice-upload-flow-support.ts`;
const amountGatePath = `${ownerRoot}/amazon-invoice-upload-amount-check.ts`;
const orderDetailPath = `${ownerRoot}/amazon-invoice-upload-order-detail.ts`;
const uploadStepsPath = `${ownerRoot}/amazon-invoice-upload-steps.ts`;
const uploadFileAttachmentPath = `${ownerRoot}/amazon-invoice-upload-file-attachment.ts`;
const taskServicePath = `${ownerRoot}/amazon-invoice-upload-task-service.ts`;
const uploadLedgerPath = `${ownerRoot}/amazon-invoice-upload-ledger.ts`;
const uploadStoragePath = `${ownerRoot}/amazon-invoice-upload-storage.ts`;
const uploadVerifyPath = `${ownerRoot}/amazon-invoice-upload-verify.ts`;
const uploadStatusPath = `${ownerRoot}/amazon-result-detector.ts`;
const existingUploadPath = `${ownerRoot}/amazon-invoice-upload-existing.ts`;
const existingEvidencePath = `${ownerRoot}/amazon-existing-invoice-evidence.ts`;
const downloadFlowPath = `${ownerRoot}/amazon-tax-invoice-download.flow.ts`;
const downloadPageStatePath = `${ownerRoot}/amazon-tax-invoice-download-page-state.ts`;
const downloadLocalArtifactPath = `${ownerRoot}/amazon-tax-invoice-download-local-artifact.ts`, downloadRuntimeHelpersPath = `${ownerRoot}/amazon-tax-invoice-download-runtime-helpers.ts`;
const evidencePath = `${ownerRoot}/amazon-tax-invoice-download-evidence.ts`;
const routesPath = "src/app/workbench-amazon-routes.ts";
const boundaryPath = "src/app/workbench-api-boundary.ts";
const browserControllerPath = "src/lib/browser/browser-controller.ts";
const chromeWindowControlPath = "src/lib/browser/exact-target/browser-command-runtime.ts";
const chromeExecutionPath = "src/lib/browser/exact-target/browser-command-runtime.ts";
const chromeScreenshotPath = "src/lib/browser/exact-target/browser-command-runtime.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const appShellAmazonInvoiceWorkspacePath = "src/app/app-shell/amazon-invoice-workspace.ts";
const appShellClientPath = "src/app/workbench-home-client.ts";
const selfPath = "scripts/audit/domains/amazon-invoice-upload/inspector.ts";
const smokeAcceptanceSupportPath = "scripts/acceptance/amazon-invoice-upload-smoke-support.ts";

const inspectedFiles = [
  lawPath,
  blueprintPath,
  processPath,
  uploadFlowPath,
  uploadFlowSupportPath,
  amountGatePath,
  orderDetailPath,
  uploadStepsPath,
  uploadFileAttachmentPath,
  taskServicePath,
  uploadLedgerPath,
  uploadStoragePath,
  uploadVerifyPath,
  uploadStatusPath,
  existingUploadPath,
  existingEvidencePath,
  downloadFlowPath,
  downloadPageStatePath,
  downloadLocalArtifactPath,
  downloadRuntimeHelpersPath,
  evidencePath,
  routesPath,
  boundaryPath,
  browserControllerPath,
  chromeWindowControlPath,
  chromeExecutionPath,
  chromeScreenshotPath,
  appShellLayoutPath,
  appShellAmazonInvoiceWorkspacePath,
  smokeAcceptanceSupportPath,
  appShellClientPath,
  "src/app/workbench-home-amazon-invoice-client.ts",
  "scripts/acceptance/amazon-invoice-upload-batch.acceptance.ts",
  "scripts/acceptance/amazon-invoice-upload-smoke.ts",
  "scripts/audit/domains/amazon-invoice-upload/inspector-amount-gate.ts",
  "scripts/audit/domains/amazon-invoice-upload/inspector-batch.ts",
  "scripts/audit/domains/amazon-invoice-upload/inspector-download-flow.ts",
  "scripts/audit/domains/amazon-invoice-upload/inspector-download-row-guards.ts",
  "scripts/audit/domains/amazon-invoice-upload/inspector-ledger.ts",
  "scripts/audit/domains/amazon-invoice-upload/inspector-upload-route-sanitizer.ts",
  "scripts/audit/domains/amazon-invoice-upload/inspector-upload-runtime-stability.ts",
  "scripts/audit/domains/amazon-invoice-upload/inspector-upload-stability.ts",
  selfPath,
];

const evidenceStepIds = [
  "AID-01",
  "AID-02",
  "AID-03",
  "AID-04",
  "AID-05",
  "AID-06",
  "AID-07",
  "AID-08",
  "AID-09",
  "AID-10",
  "AID-11",
] as const;

const forbiddenExternalKeys = [
  "selector",
  "actionPlan",
  "browserCommand",
  "flowStep",
  "documentId",
  "downloadUrl",
  "cookie",
  "sellerCentralCookie",
  "browserProfileDirectory",
] as const;

const uploadCompatibilityKeys = [
  "requireHumanFinalSubmit",
  "stopOnManualRequired",
] as const;

const requiredDownloadRoutes = [
  "/api/plugins/amazon-invoice-upload/download/start",
  "/api/plugins/amazon-invoice-upload/download/status/",
  "/api/plugins/amazon-invoice-upload/download/latest",
  "/api/plugins/amazon-invoice-upload/download/artifact/",
] as const;

type PropertyValue = string | boolean | null;

const source = (project: Project, repoPath: string): SourceFile | null =>
  project.getSourceFile(resolveFromRepo(repoPath)) ?? null;

const addFinding = (
  findings: InspectorFinding[],
  input: {
    checkId: string;
    filePath: string;
    lawId: string;
    message: string;
  },
): void => {
  findings.push(createFinding({
    checkId: input.checkId,
    lawId: input.lawId,
    filePath: input.filePath,
    message: input.message,
  }));
};

const propertyName = (property: Node): string | null => {
  if (!Node.isPropertyAssignment(property)) return null;
  const nameNode = property.getNameNode();
  if (Node.isStringLiteral(nameNode)) return nameNode.getLiteralText();
  if (Node.isIdentifier(nameNode)) return astIdentifierName(nameNode) ?? null;
  return property.getName();
};

const property = (objectLiteral: ObjectLiteralExpression, name: string) =>
  objectLiteral.getProperties().find((item) => propertyName(item) === name);

const propertyValue = (objectLiteral: ObjectLiteralExpression, name: string): PropertyValue => {
  const item = property(objectLiteral, name);
  if (!item || !Node.isPropertyAssignment(item)) return null;
  const initializer = item.getInitializer();
  if (!initializer) return null;
  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralText();
  }
  if (initializer.getKind() === SyntaxKind.TrueKeyword) return true;
  if (initializer.getKind() === SyntaxKind.FalseKeyword) return false;
  return null;
};

const exportedArray = (file: SourceFile, name: string): ArrayLiteralExpression | null => {
  const declarations = file.getExportedDeclarations().get(name) ?? [];
  const declaration = declarations.find(Node.isVariableDeclaration);
  const initializer = declaration?.getInitializer();
  if (!initializer) return null;
  if (Node.isArrayLiteralExpression(initializer)) return initializer;
  if (Node.isAsExpression(initializer)) {
    const expression = initializer.getExpression();
    return Node.isArrayLiteralExpression(expression) ? expression : null;
  }
  return null;
};

const stringLiteralValues = (file: SourceFile): Set<string> =>
  new Set([
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateHead).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateTail).map((item) => item.getLiteralText()),
  ]);

const literalCorpus = (file: SourceFile): string =>
  [...stringLiteralValues(file)].join("\n");

const inspectRequiredFiles = (
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const repoPath of [lawPath, blueprintPath, processPath, uploadFlowPath, orderDetailPath, taskServicePath, uploadLedgerPath, uploadStoragePath, uploadVerifyPath, existingUploadPath, existingEvidencePath, downloadFlowPath, downloadPageStatePath, downloadLocalArtifactPath, downloadRuntimeHelpersPath, evidencePath, routesPath, boundaryPath, appShellLayoutPath, appShellAmazonInvoiceWorkspacePath, appShellClientPath, selfPath]) {
    if (!existsSync(resolveFromRepo(repoPath))) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/required-file",
        lawId,
        filePath: repoPath,
        message: `${repoPath} must exist.`,
      });
    }
  }
};

const inspectNoSecondChainPaths = (
  findings: InspectorFinding[],
  lawId: string,
): void => {
  for (const repoPath of [
    "src/plugins/amazon-tax-invoice-download",
    "src/plugins/amazon-invoice-download",
    "scripts/audit/domains/amazon-tax-invoice-download",
  ]) {
    if (existsSync(resolveFromRepo(repoPath))) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/no-second-chain-path",
        lawId,
        filePath: repoPath,
        message: "Amazon tax invoice download must not create a second skill, plugin, or audit domain.",
      });
    }
  }
};

const inspectEvidenceMap = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!file) return;
  const values = stringLiteralValues(file);
  for (const stepId of evidenceStepIds) {
    if (!values.has(stepId)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/evidence-step-id-missing",
        lawId,
        filePath: evidencePath,
        message: `Evidence step ${stepId} must be represented in the canonical Evidence Map export.`,
      });
    }
  }
};

const inspectAppShellClient = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!file) return;
  const corpus = literalCorpus(file);
  for (const value of [
    "data-amazon-tax-invoice-download-form",
    "data-amazon-tax-invoice-download-latest",
    "data-amazon-tax-invoice-download-artifact",
    "/api/plugins/amazon-invoice-upload/download/start",
    "/api/plugins/amazon-invoice-upload/download/latest",
    "/api/plugins/amazon-invoice-upload/download/artifact/",
  ]) {
    if (!corpus.includes(value)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/app-shell-client-download-binding",
        lawId,
        filePath: appShellClientPath,
        message: `Amazon invoice App Shell client must bind ${value}.`,
      });
    }
  }
};

const inspectBoundaryRoutes = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!file) return;
  const rules = exportedArray(file, "WORKBENCH_API_ROUTE_RULES");
  const routeObjects = rules?.getElements().filter(Node.isObjectLiteralExpression) ?? [];
  for (const route of requiredDownloadRoutes) {
    const rule = routeObjects.find((item) => propertyValue(item, "path") === route);
    if (!rule) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/download-route-rule-missing",
        lawId,
        filePath: boundaryPath,
        message: `API Boundary must allowlist ${route}.`,
      });
      continue;
    }
    if (propertyValue(rule, "externalApiAllowed") !== true || propertyValue(rule, "requiresApiKey") !== true || propertyValue(rule, "jobOwner") !== "amazon-invoice-upload") {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/download-route-rule-shape",
        lawId,
        filePath: boundaryPath,
        message: `${route} must be externalApiAllowed true, requiresApiKey true, and jobOwner amazon-invoice-upload.`,
      });
    }
  }
  const keys = exportedArray(file, "EXTERNAL_REQUEST_FORBIDDEN_KEYS");
  const actual = new Set(keys?.getElements().filter(Node.isStringLiteral).map((item) => item.getLiteralText()) ?? []);
  for (const key of forbiddenExternalKeys) {
    if (!actual.has(key)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/forbidden-external-key",
        lawId,
        filePath: boundaryPath,
        message: `External request forbidden keys must include ${key}.`,
      });
    }
  }
  for (const key of uploadCompatibilityKeys) {
    if (actual.has(key)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/upload-compatibility-key-boundary-block",
        lawId,
        filePath: boundaryPath,
        message: `API Boundary must not block legacy non-control upload key ${key}; upload routes must sanitize it before the single-task service.`,
      });
    }
  }
};

const inspectAppShell = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!file) return;
  const corpus = literalCorpus(file);
  for (const value of ["download", "upload", "latest", "evidence", "Start Download", "Latest Download", "Open Artifact"]) {
    if (!corpus.includes(value)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/app-shell-surface",
        lawId,
        filePath: appShellLayoutPath,
        message: `Amazon invoice App Shell surface must expose ${value}.`,
      });
    }
  }
  for (const forbidden of ["selector", "actionPlan", "browserCommand", "documentId", "browserProfileDirectory"]) {
    if (corpus.includes(forbidden)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/app-shell-forbidden-field",
        lawId,
        filePath: appShellLayoutPath,
        message: `Amazon invoice Download UI must not expose ${forbidden}.`,
      });
    }
  }
};
const selectAmazonInvoiceLawIds = (context: InspectorContext) => ({
    owner: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-001-V1"),
    evidence: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-002-V1"),
    api: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-005-V1"),
    ui: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-006-V1"),
    artifact: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-007-V1"),
    audit: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-008-V1"),
    ledger: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-009-V1"),
    conditionalRefresh: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-011-V1"),
    batchLedgerPreflight: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-012-V1"),
    apiFocusReturn: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-013-V1"),
    amountGate: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-014-V1"),
});

type AmazonInvoiceLawIds = ReturnType<typeof selectAmazonInvoiceLawIds>;

const inspectAmazonInvoiceStaticContracts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawIds: AmazonInvoiceLawIds,
): void => {
  inspectRequiredFiles(findings, lawIds.owner);
  inspectNoSecondChainPaths(findings, lawIds.owner);
  inspectEvidenceMap(source(context.project, evidencePath), findings, lawIds.evidence);
  inspectDownloadFlow({
    file: source(context.project, downloadFlowPath),
    pageStateFile: source(context.project, downloadPageStatePath),
    findings,
    lawIds,
    ownerRoot,
    downloadFlowPath,
    downloadPageStatePath,
    evidenceStepIds,
  });
  inspectBoundaryRoutes(source(context.project, boundaryPath), findings, lawIds.api);
  inspectUploadRouteSanitizer(source(context.project, routesPath), findings, lawIds.api);
  inspectAmazonInvoiceUploadLedgerGuard(context, findings, lawIds.ledger);
  inspectAppShell(source(context.project, appShellAmazonInvoiceWorkspacePath), findings, lawIds.ui);
  inspectAppShellClient(source(context.project, appShellClientPath), findings, lawIds.ui);
};

const inspectAmazonInvoiceRuntimeContracts = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawIds: AmazonInvoiceLawIds,
): void => {
  inspectUploadStabilityGuard({
    flowFile: source(context.project, uploadFlowPath),
    flowSupportFile: source(context.project, uploadFlowSupportPath),
    orderFile: source(context.project, orderDetailPath),
    stepsFile: source(context.project, uploadStepsPath),
    fileAttachmentFile: source(context.project, uploadFileAttachmentPath),
    taskServiceFile: source(context.project, taskServicePath),
    missionSchemaFile: source(context.project, missionSchemaPath),
    verifyFile: source(context.project, uploadVerifyPath),
    existingUploadFile: source(context.project, existingUploadPath),
    existingEvidenceFile: source(context.project, existingEvidencePath),
    browserControllerFile: source(context.project, browserControllerPath),
    chromeWindowControlFile: source(context.project, chromeWindowControlPath),
    chromeExecutionFile: source(context.project, chromeExecutionPath),
    chromeScreenshotFile: source(context.project, chromeScreenshotPath),
    smokeAcceptanceFile: source(context.project, "scripts/acceptance/amazon-invoice-upload-smoke.ts"),
    smokeAcceptanceSupportFile: source(context.project, smokeAcceptanceSupportPath),
    findings,
    lawId: lawIds.audit,
    conditionalRefreshLawId: lawIds.conditionalRefresh,
    manageDialogRecoveryLawId: lawIds.batchLedgerPreflight,
    tabLifecycleLawId: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-010-V1"),
    apiFocusReturnLawId: lawIds.apiFocusReturn,
  });
  inspectAmazonInvoiceBatchGuard(context, findings, lawIds.batchLedgerPreflight);
  inspectAmazonInvoiceAmountGate({
    flowFile: source(context.project, uploadFlowPath),
    amountGateFile: source(context.project, amountGatePath),
    statusFile: source(context.project, uploadStatusPath),
    smokeAcceptanceFile: source(context.project, "scripts/acceptance/amazon-invoice-upload-smoke.ts"),
    smokeAcceptanceSupportFile: source(context.project, smokeAcceptanceSupportPath),
    findings,
    lawId: lawIds.amountGate,
  });
};

const inspectDomainEvaluation = async (context: InspectorContext): Promise<Omit<InspectorOutput, "executedChecks">> => {
  const lawIds = selectAmazonInvoiceLawIds(context);
  const findings: InspectorFinding[] = [];
  inspectAmazonInvoiceStaticContracts(context, findings, lawIds);
  inspectAmazonInvoiceRuntimeContracts(context, findings, lawIds);
  findings.push(...inspectPluginInterventionContract(context, {
    lawId: "GRASSEYE-AMAZON-INVOICE-UPLOAD-015-V1", domain,
    ownerFilePaths: ["src/plugins/amazon-invoice-upload/amazon-invoice-upload-intervention.ts"],
    routeFilePath: "src/app/workbench-amazon-routes.ts", routePrefix: "/api/amazon-invoice-upload/intervention/",
    handleMethods: ["pauseAmazonInvoiceUpload", "cancelAmazonInvoiceUpload", "takeoverAmazonInvoiceUpload", "resumeAmazonInvoiceUpload"], safePointSymbol: "awaitAmazonInvoiceUploadSafePoint",
    interventionSymbol: "requestAmazonInvoiceUploadIntervention",
    acceptancePath: "scripts/acceptance/amazon-invoice-upload-browser-intervention.acceptance.ts",
  }));

  return {
    capabilityDomain: domain,
    reportedLawIds: context.planEntry.lawIds,

    findings,
    inspectedFiles,
  };
};

export const inspectDomain = async (context: InspectorContext): Promise<SessionInspectorOutput> => {
  if (!context.checks) throw new Error("amazon-invoice-upload requires a runner-owned check session.");
  let reportJson: unknown;
  let reportMarkdown: string | undefined;
  await context.checks.runAll(async () => {
    const evaluation = await inspectDomainEvaluation(context);
    reportJson = evaluation.reportJson;
    reportMarkdown = evaluation.reportMarkdown;
    return {
      findings: evaluation.findings,
      evidenceRefs: [context.planEntry.ownerInspectorPath, ...evaluation.inspectedFiles],
    };
  });
  return context.checks.output({
    ...(reportJson === undefined ? {} : { reportJson }),
    ...(reportMarkdown === undefined ? {} : { reportMarkdown }),
  });
};
