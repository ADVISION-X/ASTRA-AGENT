import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { collectUploadRuntimeStabilityGaps } from "./inspector-upload-runtime-stability.js";
import { collectOrderRefreshGuardGaps } from "./inspector-upload-order-readiness.js";
import {
  collectEnglishUploadEvidenceGaps,
  collectExistingInvoiceEvidenceWaitGaps,
  collectNoHumanFinalSubmitContractGaps,
  collectUploadRetryGuardGaps,
  functionCallsIdentifier,
  hasObjectProperty,
  hasPropertyAssignment,
  sourceCallsMethod,
  stringLiteralValues,
} from "./inspector-upload-stability-checks.js";

const uploadFlowPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts";
const orderDetailPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-order-detail.ts";
const taskServicePath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts";
const missionSchemaPath = "src/plugins/amazon-invoice-upload/mission.schema.ts";
const verifyPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts";
const existingUploadPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-existing.ts";
const existingEvidencePath = "src/plugins/amazon-invoice-upload/amazon-existing-invoice-evidence.ts";
const flowSupportPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-flow-support.ts";
const uploadStepsPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-steps.ts";
const uploadFileAttachmentPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-file-attachment.ts";
const browserControllerPath = "src/lib/browser/browser-controller.ts";
const chromeWindowControlPath = "src/lib/browser/exact-target/browser-command-runtime.ts";
const chromeExecutionPath = "src/lib/browser/exact-target/browser-command-runtime.ts";
const chromeScreenshotPath = "src/lib/browser/exact-target/browser-command-runtime.ts";
const smokeAcceptancePath = "scripts/acceptance/amazon-invoice-upload-smoke.ts";
const smokeAcceptanceSupportPath = "scripts/acceptance/amazon-invoice-upload-smoke-support.ts";
type UploadStabilityGuardInput = { [Key in keyof UploadStabilityFiles]: SourceFile | null } & {
  findings: InspectorFinding[];
  lawId: string;
  conditionalRefreshLawId: string;
  manageDialogRecoveryLawId: string;
  tabLifecycleLawId: string;
  apiFocusReturnLawId: string;
};
export type UploadStabilityFiles = {
  flowFile: SourceFile;
  flowSupportFile: SourceFile;
  orderFile: SourceFile;
  stepsFile: SourceFile;
  fileAttachmentFile: SourceFile;
  taskServiceFile: SourceFile;
  missionSchemaFile: SourceFile;
  verifyFile: SourceFile;
  existingUploadFile: SourceFile;
  existingEvidenceFile: SourceFile;
  browserControllerFile: SourceFile;
  chromeWindowControlFile: SourceFile;
  chromeExecutionFile: SourceFile;
  chromeScreenshotFile: SourceFile;
  smokeAcceptanceFile: SourceFile;
  smokeAcceptanceSupportFile: SourceFile;
};
export const inspectUploadStabilityGuard = (input: UploadStabilityGuardInput): void => {
  const files = resolveUploadStabilityFiles(input);
  if (!files) return;
  const refreshMissing = collectOrderRefreshGuardGaps(files);
  appendUploadStabilityFindings(input.findings, input.conditionalRefreshLawId, refreshMissing);
  const missing = collectUploadStabilityGaps(files);
  const manageDialogMissing = collectExistingInvoiceEvidenceWaitGaps(files.existingUploadFile);
  writeUploadStabilityDebug(missing.length + manageDialogMissing.length);
  appendUploadStabilityFindings(input.findings, input.lawId, missing);
  appendUploadStabilityFindings(input.findings, input.manageDialogRecoveryLawId, manageDialogMissing);
  const tabLifecycleMissing = collectTabLifecycleGaps(files);
  appendUploadStabilityFindings(input.findings, input.tabLifecycleLawId, tabLifecycleMissing);
  const apiFocusMissing = collectApiFocusReturnGaps(files);
  appendUploadStabilityFindings(input.findings, input.apiFocusReturnLawId, apiFocusMissing);
};

function resolveUploadStabilityFiles(input: UploadStabilityGuardInput): UploadStabilityFiles | null {
  const requiredFiles = [
    [uploadFlowPath, input.flowFile],
    [flowSupportPath, input.flowSupportFile],
    [orderDetailPath, input.orderFile],
    [uploadStepsPath, input.stepsFile],
    [uploadFileAttachmentPath, input.fileAttachmentFile],
    [taskServicePath, input.taskServiceFile],
    [missionSchemaPath, input.missionSchemaFile],
    [verifyPath, input.verifyFile],
    [existingUploadPath, input.existingUploadFile],
    [existingEvidencePath, input.existingEvidenceFile],
    [browserControllerPath, input.browserControllerFile],
    [chromeWindowControlPath, input.chromeWindowControlFile],
    [chromeExecutionPath, input.chromeExecutionFile],
    [chromeScreenshotPath, input.chromeScreenshotFile],
    [smokeAcceptancePath, input.smokeAcceptanceFile],
    [smokeAcceptanceSupportPath, input.smokeAcceptanceSupportFile],
  ] as const;
  const missingFiles = requiredFiles.filter(([, file]) => !file).map(([repoPath]) => repoPath);
  if (missingFiles.length > 0) {
    appendUploadStabilityFindings(input.findings, input.lawId, missingFiles.map((repoPath) => `required source missing: ${repoPath}`));
    return null;
  }
  return input as UploadStabilityFiles;
}

function writeUploadStabilityDebug(missingCount: number): void {
  process.stdout.write(`[AUDIT][amazon-invoice-upload][upload-stability] checked refresh/retry guards; missing=${missingCount}\n`);
}

function appendUploadStabilityFindings(findings: InspectorFinding[], lawId: string, missing: string[]): void {
  for (const item of missing) {
    findings.push(createFinding({
      checkId: "amazon-invoice-upload/upload-stability-refresh-retry",
      lawId,
      filePath: uploadStabilityFindingPath(item),
      message: `Amazon invoice upload stability guard missing: ${item}.`,
    }));
  }
}

function collectUploadStabilityGaps(files: UploadStabilityFiles): string[] {
  return [
    ...collectUploadRetryGuardGaps(files.flowFile),
    ...collectUploadRuntimeStabilityGaps(files),
    ...collectOrderNavigationProofGaps(files),
    ...collectNoHumanFinalSubmitContractGaps(files.taskServiceFile, files.missionSchemaFile),
    ...collectEnglishUploadEvidenceGaps(files.verifyFile, files.existingUploadFile, files.existingEvidenceFile),
  ];
}

function uploadStabilityFindingPath(item: string): string {
  const tabLifecyclePath = tabLifecycleFindingPath(item);
  if (tabLifecyclePath) return tabLifecyclePath;
  const apiFocusPath = apiFocusFindingPath(item);
  if (apiFocusPath) return apiFocusPath;
  const prefixPaths: ReadonlyArray<readonly [prefix: string, repoPath: string]> = [
    ["english-success-evidence", verifyPath],
    ["english-existing-evidence", existingEvidencePath],
    ["existing-invoice-evidence", existingUploadPath],
    ["no-human-final-submit-schema", missionSchemaPath],
    ["no-human-final-submit-service", taskServicePath],
    ["snapshot-deadline-flow-support", flowSupportPath],
    ["snapshot-deadline-order-detail", orderDetailPath],
    ["snapshot-deadline-screenshot", chromeScreenshotPath],
    ["pure-browser-read", chromeWindowControlPath],
    ["pure-browser-wait", chromeExecutionPath],
    ["execution-lease", taskServicePath],
    ["terminal-timeout", taskServicePath],
    ["order-detail-window8-smoke-assertion", smokeAcceptancePath],
    ["order-detail-window8-smoke-signal", smokeAcceptanceSupportPath],
  ];
  const prefixPath = prefixPaths.find(([prefix]) => item.startsWith(prefix));
  return prefixPath?.[1] ?? (isOrderRefreshFinding(item) ? orderDetailPath : uploadFlowPath);
}

function apiFocusFindingPath(item: string): string | null {
  if (item.startsWith("api-focus-schema")) return missionSchemaPath;
  if (item.startsWith("api-focus-service")) return taskServicePath;
  if (item.startsWith("api-focus-controller")) return browserControllerPath;
  if (item.startsWith("api-focus-browser")) return chromeWindowControlPath;
  return null;
}

function collectApiFocusReturnGaps(files: UploadStabilityFiles): string[] {
  const missing = collectApiFocusSchemaGaps(files);
  for (const retired of [
    "returnApiUploadFocusToAdmin",
    "returnApiUploadFocusToAdminBounded",
    "focusOnlyExistingTab",
  ]) {
    if (files.taskServiceFile.getDescendantsOfKind(SyntaxKind.Identifier).some(
      (identifier) => astIdentifierName(identifier) === retired,
    )) missing.push(`api-focus-service:retired-${retired}`);
  }
  const forbiddenPolicies = ["focus-existing-same-path-url", "reuse-host-tab"];
  const combinedValues = new Set([
    ...stringLiteralValues(files.taskServiceFile),
    ...stringLiteralValues(files.browserControllerFile),
    ...stringLiteralValues(files.chromeWindowControlFile),
  ]);
  for (const policy of forbiddenPolicies) {
    if (combinedValues.has(policy)) missing.push(`api-focus-service:retired-policy-${policy}`);
  }
  if (!stringLiteralValues(files.orderFile).has("reuse-exact-url")) {
    missing.push("api-focus-service:exact-target-navigation");
  }
  return missing;
}

function collectApiFocusSchemaGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  if (!hasPropertyAssignment(files.missionSchemaFile, "sourceSystem")) missing.push("api-focus-schema:sourceSystem");
  if (!hasPropertyAssignment(files.missionSchemaFile, "requestId")) missing.push("api-focus-schema:requestId");
  return missing;
}

function tabLifecycleFindingPath(item: string): string | null {
  if (item.startsWith("tab-lifecycle-existing")) return existingUploadPath;
  if (item.startsWith("tab-lifecycle-verify")) return verifyPath;
  if (item.startsWith("tab-lifecycle-order")) return orderDetailPath;
  return null;
}

function collectTabLifecycleGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  const orderValues = stringLiteralValues(files.orderFile);
  const verifyValues = stringLiteralValues(files.verifyFile);
  const existingValues = stringLiteralValues(files.existingUploadFile);
  if (!orderValues.has("reuse-exact-url")) missing.push("tab-lifecycle-order:reuse-exact-url");
  if (!sourceCallsMethod(files.orderFile, "getGeometrySnapshot")) {
    missing.push("tab-lifecycle-order:refresh-current-chrome-state");
  }
  if (!verifyValues.has("retain uploaded order tab")) missing.push("tab-lifecycle-verify:retain-uploaded-trace");
  if (!existingValues.has("retain already uploaded order tab")) missing.push("tab-lifecycle-existing:retain-already-uploaded-trace");
  if (sourceCallsMethod(files.verifyFile, "closeActiveTab")) missing.push("tab-lifecycle-verify:no-per-item-close");
  if (sourceCallsMethod(files.existingUploadFile, "closeActiveTab")) missing.push("tab-lifecycle-existing:no-per-item-close");
  return missing;
}

function isOrderRefreshFinding(item: string): boolean {
  return item.startsWith("order-detail") || item.startsWith("single-order-navigation");
}

function collectOrderNavigationProofGaps(files: UploadStabilityFiles): string[] {
  return [
    ...collectOpenReceiptGaps(files),
    ...collectReadinessObservationGaps(files),
    ...collectExecutionLeaseGaps(files),
    ...collectPureBrowserReadGaps(files),
  ];
}

function collectOpenReceiptGaps(files: UploadStabilityFiles): string[] {
  return [
    ...collectOpenResultConsumptionGaps(files),
    ...collectNavigationEvidenceWriterGaps(files),
  ];
}

function collectOpenResultConsumptionGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  const openFunction = files.orderFile.getFunction("openAndPersistOrderDetailNavigation");
  const openCalls = openFunction?.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) return false;
    const owner = expression.getExpression();
    return Node.isPropertyAccessExpression(owner)
      && owner.getName() === "browser"
      && expression.getName() === "open";
  }) ?? [];
  if (openCalls.length !== 1) missing.push("single-order-navigation:owned-open-count");
  if (!openCalls.some((call) => {
    const awaitExpression = call.getParent();
    const assignment = awaitExpression?.getParent();
    return Node.isAwaitExpression(awaitExpression)
      && Node.isBinaryExpression(assignment)
      && assignment.getOperatorToken().getKind() === SyntaxKind.EqualsToken
      && Node.isIdentifier(assignment.getLeft())
      && astIdentifierName(assignment.getLeft()) === "openResult";
  })) missing.push("single-order-navigation:open-result-assigned");

  const receiptValidator = files.orderFile.getFunction("hasStructuredNavigationReceipt");
  const openResultProperties = new Set([
    ...files.orderFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .filter((access) => Node.isIdentifier(access.getExpression())
        && astIdentifierName(access.getExpression()) === "openResult"),
    ...(receiptValidator?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression) ?? []),
  ].map((access) => access.getName()));
  for (const property of ["ok", "actionKind", "navigationMode", "observedUrl", "observedUrlMatchesRequest", "startedAt", "durationMs"]) {
    if (!openResultProperties.has(property)) missing.push(`single-order-navigation:consume-open-result:${property}`);
  }
  return missing;
}

function collectNavigationEvidenceWriterGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  const appendRecordCalls = files.orderFile.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression) || expression.getName() !== "appendRecord") return false;
    const owner = expression.getExpression();
    return Node.isPropertyAccessExpression(owner) && owner.getName() === "evidenceStore";
  });
  if (appendRecordCalls.length !== 1) {
    missing.push("single-order-navigation:forensics-writer-count");
  }
  for (const property of ["browserActionId", "integrityHash", "storageRef", "evidenceRef", "orderNavigationProof"]) {
    if (!hasObjectProperty(files.orderFile, property)) missing.push(`single-order-navigation:proof-field:${property}`);
  }
  return missing;
}
function collectReadinessObservationGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  if (!functionCallsIdentifier(files.orderFile, "openApprovedOrderDetail", "waitForApprovedOrderDetail")) {
    missing.push("single-order-navigation:readiness-owner-call");
  }
  const waitNode = files.orderFile.getVariableDeclaration("waitForApprovedOrderDetail")?.getInitializer();
  if (!(waitNode?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    Node.isIdentifier(call.getExpression())
    && astIdentifierName(call.getExpression()) === "startAmazonDomStepTrace") ?? false)) {
    missing.push("single-order-navigation:truthful-observation-start");
  }
  if (!stringLiteralValues(files.orderFile).has("observe approved order detail readiness window ")) {
    missing.push("single-order-navigation:observation-window-identity");
  }
  const falseOpenStepName = files.orderFile.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    if (property.getName() !== "stepName") return false;
    const initializer = property.getInitializer();
    return Node.isStringLiteral(initializer) && initializer.getLiteralText() === "open approved order detail";
  });
  if (falseOpenStepName) missing.push("single-order-navigation:observation-labelled-open");
  return missing;
}
function collectExecutionLeaseGaps(files: UploadStabilityFiles): string[] {
  return [
    ...collectSingleFlightLeaseGaps(files),
    ...collectTerminalGuardGaps(files),
  ];
}
function collectSingleFlightLeaseGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  for (const functionName of ["startAmazonInvoiceUploadMission", "startAmazonInvoiceUploadTask", "resumeAmazonInvoiceUploadTask"]) {
    if (!functionCallsIdentifier(files.taskServiceFile, functionName, "withAmazonInvoiceExecutionLease")) {
      missing.push(`execution-lease:missing-owner-call:${functionName}`);
    }
  }
  const leaseFunction = files.taskServiceFile.getFunction("withAmazonInvoiceExecutionLease");
  const leaseMethods = new Set(leaseFunction?.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression).map((access) => access.getName()) ?? []);
  if (!leaseMethods.has("setExecutionAbortSignal")) missing.push("execution-lease:browser-abort-signal");
  if (!(leaseFunction?.getDescendantsOfKind(SyntaxKind.TryStatement).some((statement) => Boolean(statement.getFinallyBlock())) ?? false)) {
    missing.push("execution-lease:finally-release");
  }
  if (!leaseFunction?.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === "activeUploadExecutionId")) {
    missing.push("execution-lease:single-flight-state");
  }
  return missing;
}
function collectTerminalGuardGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  const terminalGuard = files.taskServiceFile.getFunction("runAmazonInvoiceUploadWithTerminalGuard");
  if (!(terminalGuard?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "abort";
  }) ?? false)) missing.push("terminal-timeout:abort-active-flow");
  if (terminalGuard?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && Node.isIdentifier(expression.getExpression())
      && astIdentifierName(expression.getExpression()) === "Promise"
      && expression.getName() === "race";
  })) missing.push("terminal-timeout:detached-promise-race");
  if (!(terminalGuard?.getDescendantsOfKind(SyntaxKind.AwaitExpression).some((awaitExpression) =>
    awaitExpression.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
      Node.isIdentifier(call.getExpression())
      && astIdentifierName(call.getExpression()) === "runAmazonInvoiceUpload")) ?? false)) {
    missing.push("terminal-timeout:await-flow-settlement");
  }
  return missing;
}
function collectPureBrowserReadGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  const exactIdentifiers = new Set(files.chromeWindowControlFile
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .flatMap((identifier) => astIdentifierName(identifier) ?? []));
  for (const required of ["BrowserTargetRegistry", "targetRef", "documentRef"]) {
    if (!exactIdentifiers.has(required)) missing.push(`pure-browser-read:missing-exact-identity:${required}`);
  }
  const waitFunction = files.chromeExecutionFile.getClass("ExactBrowserTargetSession")?.getMethod("wait");
  if (!(waitFunction?.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === "abortSignal") ?? false)) {
    missing.push("pure-browser-wait:abort-signal");
  }
  if (waitFunction?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    const name = astIdentifierName(expression);
    return Node.isIdentifier(expression) && (name === "refreshSnapshot" || name === "_refreshSnapshot");
  })) missing.push("pure-browser-wait:no-refresh-snapshot");
  return missing;
}
