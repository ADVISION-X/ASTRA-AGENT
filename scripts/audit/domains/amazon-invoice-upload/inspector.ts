import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  Node,
  Project,
  SyntaxKind,
  type ArrayLiteralExpression,
  type ObjectLiteralExpression,
  type SourceFile,
} from "ts-morph";

import { buildAuditArtifacts } from "../../build-audit-artifacts.js";
import { loadGeneratedAuditPlan } from "../../core/load-audit-plan.js";
import { createFinding, selectLawId } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding, InspectorOutput } from "../../shared/inspector-contracts.js";
import { createAuditProject } from "../../shared/project.js";
import { resolveFromRepo, toRepoPath } from "../../shared/paths.js";

const domain = "amazon-invoice-upload";
const lawPath = ".github/instructions/agent-rules/modules/module-amazon-invoice-upload.instructions.md";
const blueprintPath = "docs/法案辅助文件/GrassEye Amazon Invoice Upload Unified Chain 施工图.md";
const processPath = "docs/法案辅助文件/amazon_invoice_upload_process.md";
const ownerRoot = "src/plugins/amazon-invoice-upload";
const uploadFlowPath = `${ownerRoot}/amazon-invoice-upload.flow.ts`;
const orderDetailPath = `${ownerRoot}/amazon-invoice-upload-order-detail.ts`;
const downloadFlowPath = `${ownerRoot}/amazon-tax-invoice-download.flow.ts`;
const evidencePath = `${ownerRoot}/amazon-tax-invoice-download-evidence.ts`;
const routesPath = "src/app/workbench-amazon-routes.ts";
const boundaryPath = "src/app/workbench-api-boundary.ts";
const appShellLayoutPath = "src/app/app-shell/app-shell-layout.ts";
const appShellClientPath = "src/app/workbench-home-client.ts";
const selfPath = "scripts/audit/domains/amazon-invoice-upload/inspector.ts";

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
  if (Node.isIdentifier(nameNode)) return nameNode.getText();
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
  for (const repoPath of [lawPath, blueprintPath, processPath, uploadFlowPath, orderDetailPath, downloadFlowPath, evidencePath, routesPath, boundaryPath, appShellLayoutPath, appShellClientPath, selfPath]) {
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

const hasConstInitializer = (file: SourceFile, name: string, initializerText: string): boolean =>
  file.getVariableDeclaration(name)?.getInitializer()?.getText() === initializerText;

const functionCallsIdentifier = (file: SourceFile, functionName: string, calleeName: string): boolean =>
  (file.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
    .some((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === calleeName);

const sourceCallsProperty = (file: SourceFile, ownerName: string, methodName: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression)
        && Node.isIdentifier(expression.getExpression())
        && expression.getExpression().getText() === ownerName
        && expression.getName() === methodName;
    });

const retryStepNames = (file: SourceFile): Set<string> =>
  new Set(file.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    if (!Node.isIdentifier(call.getExpression()) || call.getExpression().getText() !== "runUploadStepWithRetries") return [];
    const argument = call.getArguments()[0];
    return Node.isObjectLiteralExpression(argument) ? [propertyValue(argument, "stepName")].filter((value): value is string => typeof value === "string") : [];
  }));

const inspectUploadStabilityGuard = (
  flowFile: SourceFile | null,
  orderFile: SourceFile | null,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  if (!flowFile || !orderFile) return;
  const flowValues = stringLiteralValues(flowFile);
  const orderValues = stringLiteralValues(orderFile);
  const missing: string[] = [];
  if (!hasConstInitializer(orderFile, "ORDER_DETAIL_REFRESH_WAIT_MIN_MS", "3_000")) missing.push("refresh-min-3000");
  if (!hasConstInitializer(orderFile, "ORDER_DETAIL_REFRESH_WAIT_MAX_MS", "6_000")) missing.push("refresh-max-6000");
  if (!functionCallsIdentifier(orderFile, "openApprovedOrderDetail", "refreshApprovedOrderDetailOnce")) missing.push("order-detail-refresh-call");
  if (!sourceCallsProperty(orderFile, "Math", "random")) missing.push("random-refresh-wait");
  for (const value of ["Amazon Seller Central approved order detail refresh", "refresh approved order detail before upload"]) {
    if (!orderValues.has(value)) missing.push(value);
  }
  if (!hasConstInitializer(flowFile, "UPLOAD_STEP_RETRY_LIMIT", "2")) missing.push("retry-limit-2");
  if (!flowFile.getFunction("runUploadStepWithRetries")) missing.push("recursive-retry-function");
  if (!functionCallsIdentifier(flowFile, "runUploadStepWithRetries", "runUploadStepWithRetries")) missing.push("recursive-retry-self-call");
  for (const stepName of ["open order detail", "open upload invoice entry", "upload approved invoice"]) {
    if (!retryStepNames(flowFile).has(stepName)) missing.push(`retry-step:${stepName}`);
  }
  if (!flowValues.has("file attached before final submit") || !flowValues.has("verify upload success")) missing.push("retry-sensitive-terminal-gates");
  process.stdout.write(`[AUDIT][amazon-invoice-upload][upload-stability] checked refresh/retry guards; missing=${missing.length}\n`);
  for (const item of missing) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/upload-stability-refresh-retry",
      lawId,
      filePath: item.startsWith("refresh") || item === "order-detail-refresh-call" || item === "random-refresh-wait" ? orderDetailPath : uploadFlowPath,
      message: `Amazon invoice upload stability guard missing: ${item}.`,
    });
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

const inspectDownloadFlow = (
  file: SourceFile | null,
  findings: InspectorFinding[],
  lawIds: { evidence: string; owner: string; artifact: string },
): void => {
  if (!file) return;
  const repoPath = toRepoPath(file.getFilePath());
  if (!repoPath.startsWith(ownerRoot)) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/download-flow-owner",
      lawId: lawIds.owner,
      filePath: repoPath,
      message: "Download flow must live under src/plugins/amazon-invoice-upload.",
    });
  }
  const values = stringLiteralValues(file);
  for (const stepId of evidenceStepIds) {
    if (!values.has(stepId)) {
      addFinding(findings, {
        checkId: "amazon-invoice-upload/download-flow-step-id",
        lawId: lawIds.evidence,
        filePath: downloadFlowPath,
        message: `Download flow must cite Evidence Map step ${stepId}.`,
      });
    }
  }
  const calls = file.getDescendantsOfKind(SyntaxKind.CallExpression);
  if (!calls.some((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "recordAmazonDomStepTrace")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/download-flow-dom-trace",
      lawId: lawIds.evidence,
      filePath: downloadFlowPath,
      message: "Download flow must call recordAmazonDomStepTrace.",
    });
  }
  if (!values.has("manual_required")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/download-flow-manual-required",
      lawId: lawIds.evidence,
      filePath: downloadFlowPath,
      message: "Download flow must expose manual_required gates.",
    });
  }
  if (!values.has("Latest row is not proven to be the current requested CSV report.")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/current-request-row-gate",
      lawId: lawIds.evidence,
      filePath: downloadFlowPath,
      message: "Download flow must reject rows that are not proven to be the current requested CSV report.",
    });
  }
  if (!values.has("进行中")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/current-request-in-progress-gate",
      lawId: lawIds.evidence,
      filePath: downloadFlowPath,
      message: "Download flow must observe the current requested row entering 进行中 before waiting for 下载.",
    });
  }
  if (values.has("documentId")) {
    addFinding(findings, {
      checkId: "amazon-invoice-upload/no-document-id-log",
      lawId: lawIds.artifact,
      filePath: downloadFlowPath,
      message: "Download flow must not persist or log Amazon download documentId.",
    });
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

export const inspectDomain = async (context: InspectorContext): Promise<InspectorOutput> => {
  const lawIds = {
    owner: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-001-V1"),
    evidence: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-002-V1"),
    api: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-005-V1"),
    ui: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-006-V1"),
    artifact: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-007-V1"),
    audit: selectLawId(context.planEntry.lawIds, "GRASSEYE-AMAZON-INVOICE-UPLOAD-008-V1"),
  };
  const findings: InspectorFinding[] = [];
  inspectRequiredFiles(findings, lawIds.owner);
  inspectNoSecondChainPaths(findings, lawIds.owner);
  inspectEvidenceMap(source(context.project, evidencePath), findings, lawIds.evidence);
  inspectDownloadFlow(source(context.project, downloadFlowPath), findings, lawIds);
  inspectBoundaryRoutes(source(context.project, boundaryPath), findings, lawIds.api);
  inspectAppShell(source(context.project, appShellLayoutPath), findings, lawIds.ui);
  inspectAppShellClient(source(context.project, appShellClientPath), findings, lawIds.ui);
  inspectUploadStabilityGuard(source(context.project, uploadFlowPath), source(context.project, orderDetailPath), findings, lawIds.audit);

  return {
    capabilityDomain: domain,
    reportedLawIds: context.planEntry.lawIds,
    findings,
    inspectedFiles: [
      lawPath,
      blueprintPath,
      processPath,
      uploadFlowPath,
      orderDetailPath,
      downloadFlowPath,
      evidencePath,
      routesPath,
      boundaryPath,
      appShellLayoutPath,
      appShellClientPath,
      selfPath,
    ],
  };
};

const runInspectorFromCli = async (): Promise<void> => {
  buildAuditArtifacts();
  const planEntry = loadGeneratedAuditPlan().find((entry) => entry.capabilityDomain === domain);
  if (!planEntry) {
    throw new Error("amazon-invoice-upload audit plan entry is missing.");
  }
  const output = await inspectDomain({
    project: createAuditProject(),
    planEntry,
    generatedPlan: [planEntry],
    completedReports: {},
  });
  if (output.findings.length > 0) {
    throw new Error(`amazon-invoice-upload failed with ${output.findings.length} finding(s).`);
  }
  process.stdout.write("[AUDIT] amazon-invoice-upload PASS\n");
};

const isEntrypoint = (): boolean => {
  const invokedPath = process.argv[1];
  return invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url);
};

if (isEntrypoint()) {
  await runInspectorFromCli();
}
