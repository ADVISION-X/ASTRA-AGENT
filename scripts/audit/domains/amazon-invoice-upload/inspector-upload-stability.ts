import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";
import { collectUploadRuntimeStabilityGaps } from "./inspector-upload-runtime-stability.js";
import { collectOrderRefreshGuardGaps } from "./inspector-upload-order-readiness.js";
import { collectEnglishUploadEvidenceGaps, collectExistingInvoiceEvidenceWaitGaps, collectNoHumanFinalSubmitContractGaps, collectUploadRetryGuardGaps, functionCallsIdentifier, functionCallsProperty, hasObjectProperty, hasPropertyAssignment, hasTemplateExpressionWithIdentifier, hasTruePropertyAssignment, retryStepNames, sourceCallsMethod, sourceCallsProperty, stringLiteralValues } from "./inspector-upload-stability-checks.js";

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
const chromeWindowControlPath = "src/lib/browser/current-chrome-window-control.ts";
const chromeExecutionPath = "src/lib/browser/current-chrome-browser-controller-execution.ts";
const chromeScreenshotPath = "src/lib/browser/current-chrome-browser-screenshot.ts";
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
  const taskValues = stringLiteralValues(files.taskServiceFile);
  const controllerValues = stringLiteralValues(files.browserControllerFile);
  const chromeValues = stringLiteralValues(files.chromeWindowControlFile);
  return [
    ...collectApiFocusSchemaGaps(files),
    ...collectApiFocusServiceGaps(files, taskValues),
    ...collectApiFocusBrowserGaps(files, controllerValues, chromeValues),
  ];
}

function collectApiFocusSchemaGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  if (!hasPropertyAssignment(files.missionSchemaFile, "sourceSystem")) missing.push("api-focus-schema:sourceSystem");
  if (!hasPropertyAssignment(files.missionSchemaFile, "requestId")) missing.push("api-focus-schema:requestId");
  return missing;
}

function collectApiFocusServiceGaps(files: UploadStabilityFiles, taskValues: Set<string>): string[] {
  return [
    ...collectApiFocusServiceRouteGaps(files, taskValues),
    ...collectApiFocusServiceAbortGaps(files),
  ];
}

function collectApiFocusServiceRouteGaps(files: UploadStabilityFiles, taskValues: Set<string>): string[] {
  const missing: string[] = [];
  const returnHelper = files.taskServiceFile.getFunction("returnApiUploadFocusToAdmin");
  if (!returnHelper) missing.push("api-focus-service:return-helper");
  if (!files.taskServiceFile.getFunction("isApiUploadMission")) missing.push("api-focus-service:api-source-guard");
  if (!functionCallsIdentifier(files.taskServiceFile, "startAmazonInvoiceUploadTask", "returnApiUploadFocusToAdmin")) {
    missing.push("api-focus-service:start-call");
  }
  if (!functionCallsIdentifier(files.taskServiceFile, "resumeAmazonInvoiceUploadTask", "returnApiUploadFocusToAdmin")) {
    missing.push("api-focus-service:resume-call");
  }
  if (!functionCallsIdentifier(files.taskServiceFile, "returnApiUploadFocusToAdmin", "startAmazonInvoiceAdminOpenTask")) {
    missing.push("api-focus-service:admin-allowlist-open");
  }
  if (!hasPropertyAssignment(files.taskServiceFile, "focusOnlyExistingTab")) missing.push("api-focus-service:explicit-focus-flag");
  if (!hasTruePropertyAssignment(files.taskServiceFile, "focusOnlyExistingTab")) missing.push("api-focus-service:return-helper-explicit-focus");
  if (!hasFocusOnlyReusePolicyConditional(files.taskServiceFile)) {
    missing.push("api-focus-service:normal-open-not-focus-only");
  }
  if (!taskValues.has("focus-existing-same-path-url")) missing.push("api-focus-service:same-path-focus-only-policy");
  if (!taskValues.has("return API upload focus to website")) missing.push("api-focus-service:runtime-trace");
  if (hasPromiseRace(files.taskServiceFile)) missing.push("api-focus-service:detached-promise-race");
  return missing;
}

function collectApiFocusServiceAbortGaps(files: UploadStabilityFiles): string[] {
  return [
    ...collectBoundedFocusAbortGaps(files),
    ...collectFocusAbortPropagationGaps(files),
  ];
}

function collectBoundedFocusAbortGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  const boundedHelper = files.taskServiceFile.getFunction("returnApiUploadFocusToAdminBounded");
  if (!boundedHelper) missing.push("api-focus-service:bounded-return-helper");
  if (!(boundedHelper?.getDescendantsOfKind(SyntaxKind.NewExpression).some((expression) =>
    Node.isIdentifier(expression.getExpression()) && expression.getExpression().getText() === "AbortController") ?? false)) {
    missing.push("api-focus-service:bounded-abort-controller");
  }
  if (!(boundedHelper?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === "abort";
  }) ?? false)) missing.push("api-focus-service:timeout-aborts-focus");
  if (!(boundedHelper?.getDescendantsOfKind(SyntaxKind.AwaitExpression).some((awaitExpression) =>
    awaitExpression.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
      const expression = call.getExpression();
      return Node.isPropertyAccessExpression(expression)
        && Node.isIdentifier(expression.getExpression())
        && expression.getExpression().getText() === "input"
        && expression.getName() === "focus";
    })) ?? false)) missing.push("api-focus-service:await-focus-settlement");
  return missing;
}

function collectFocusAbortPropagationGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  const returnHelper = files.taskServiceFile.getFunction("returnApiUploadFocusToAdmin");
  if (!(returnHelper?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) =>
    identifier.getText() === "abortSignal") ?? false)) missing.push("api-focus-service:return-helper-abort-signal");
  const adminOpen = files.taskServiceFile.getFunction("startAmazonInvoiceAdminOpenTask");
  if (!(adminOpen?.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === "abortSignal") ?? false)) missing.push("api-focus-service:browser-open-abort-signal");
  return missing;
}

function hasPromiseRace(file: SourceFile): boolean {
  return file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && Node.isIdentifier(expression.getExpression())
      && expression.getExpression().getText() === "Promise"
      && expression.getName() === "race";
  });
}

function collectApiFocusBrowserGaps(
  files: UploadStabilityFiles,
  controllerValues: Set<string>,
  chromeValues: Set<string>,
): string[] {
  const missing: string[] = [];
  if (!controllerValues.has("focus-existing-same-path-url")) missing.push("api-focus-controller:same-path-policy-type");
  if (!chromeValues.has("focus-existing-same-path-url")) missing.push("api-focus-browser:same-path-policy-implementation");
  if (!chromeValues.has("focused_existing_same_path_tab")) missing.push("api-focus-browser:same-path-focus-result");
  if (!chromeValues.has("no_existing_tab")) missing.push("api-focus-browser:missing-tab-fails-closed");
  if (hasTemplateExpressionWithIdentifier(files.chromeWindowControlFile, "input")) {
    missing.push("api-focus-browser:no-full-url-leak");
  }
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
  if (!orderValues.has("reuse-active-tab")) missing.push("tab-lifecycle-order:reuse-active-tab");
  if (!orderValues.has("reuse-host-tab")) missing.push("tab-lifecycle-order:reuse-host-tab");
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
      && assignment.getLeft().getText() === "openResult";
  })) missing.push("single-order-navigation:open-result-assigned");

  const receiptValidator = files.orderFile.getFunction("hasStructuredNavigationReceipt");
  const openResultProperties = new Set([
    ...files.orderFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)
      .filter((access) => Node.isIdentifier(access.getExpression()) && access.getExpression().getText() === "openResult"),
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
    Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "startAmazonDomStepTrace") ?? false)) {
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
  if (!leaseFunction?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === "activeUploadExecutionId")) {
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
      && expression.getExpression().getText() === "Promise"
      && expression.getName() === "race";
  })) missing.push("terminal-timeout:detached-promise-race");
  if (!(terminalGuard?.getDescendantsOfKind(SyntaxKind.AwaitExpression).some((awaitExpression) =>
    awaitExpression.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
      Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "runAmazonInvoiceUpload")) ?? false)) {
    missing.push("terminal-timeout:await-flow-settlement");
  }
  return missing;
}
function collectPureBrowserReadGaps(files: UploadStabilityFiles): string[] {
  const missing: string[] = [];
  const stateRead = files.chromeWindowControlFile.getVariableDeclaration("readFrontChromeWindowState")?.getInitializer();
  if (!stateRead || !Node.isArrowFunction(stateRead)
    || stateRead.getParameters().some((parameter) => parameter.getName() !== "abortSignal")) {
    missing.push("pure-browser-read:no-fallback-input");
  }
  const readIdentifiers = new Set(stateRead?.getDescendantsOfKind(SyntaxKind.Identifier).map((identifier) => identifier.getText()) ?? []);
  for (const forbidden of ["fallbackUrl", "restoreUrl", "buildOpenUrlScript"]) {
    if (readIdentifiers.has(forbidden)) missing.push(`pure-browser-read:no-hidden-navigation:${forbidden}`);
  }
  const waitFunction = files.chromeExecutionFile.getVariableDeclaration("waitForDuration")?.getInitializer();
  if (!(waitFunction?.getDescendantsOfKind(SyntaxKind.Identifier).some((identifier) => identifier.getText() === "abortSignal") ?? false)) {
    missing.push("pure-browser-wait:abort-signal");
  }
  if (waitFunction?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isIdentifier(expression) && (expression.getText() === "refreshSnapshot" || expression.getText() === "_refreshSnapshot");
  })) missing.push("pure-browser-wait:no-refresh-snapshot");
  return missing;
}
function hasFocusOnlyReusePolicyConditional(file: SourceFile): boolean {
  return file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) => {
    if (property.getName() !== "reusePolicy") return false;
    const initializer = property.getInitializer();
    if (!initializer || !Node.isConditionalExpression(initializer)) return false;
    const condition = initializer.getCondition();
    const whenTrue = initializer.getWhenTrue();
    const whenFalse = initializer.getWhenFalse();
    if (!Node.isBinaryExpression(condition)) return false;
    const left = condition.getLeft();
    const right = condition.getRight();
    const operatorIsStrictEquals = condition.getOperatorToken().getKind() === SyntaxKind.EqualsEqualsEqualsToken;
    const leftIsFocusFlag = Node.isPropertyAccessExpression(left)
      && left.getExpression().getKind() === SyntaxKind.Identifier
      && left.getName() === "focusOnlyExistingTab";
    return operatorIsStrictEquals
      && leftIsFocusFlag
      && right.getKind() === SyntaxKind.TrueKeyword
      && Node.isStringLiteral(whenTrue)
      && whenTrue.getLiteralText() === "focus-existing-same-path-url"
      && Node.isStringLiteral(whenFalse)
      && whenFalse.getLiteralText() === "reuse-exact-url";
  });
}
