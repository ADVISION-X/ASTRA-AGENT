import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

const uploadFlowPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts";
const orderDetailPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-order-detail.ts";
const taskServicePath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts";
const missionSchemaPath = "src/plugins/amazon-invoice-upload/mission.schema.ts";
const verifyPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts";
const existingUploadPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-existing.ts";
const existingEvidencePath = "src/plugins/amazon-invoice-upload/amazon-existing-invoice-evidence.ts";
const browserControllerPath = "src/lib/browser/browser-controller.ts";
const chromeWindowControlPath = "src/lib/browser/current-chrome-window-control.ts";

type UploadStabilityGuardInput = {
  flowFile: SourceFile | null;
  orderFile: SourceFile | null;
  taskServiceFile: SourceFile | null;
  missionSchemaFile: SourceFile | null;
  verifyFile: SourceFile | null;
  existingUploadFile: SourceFile | null;
  existingEvidenceFile: SourceFile | null;
  browserControllerFile: SourceFile | null;
  chromeWindowControlFile: SourceFile | null;
  findings: InspectorFinding[];
  lawId: string;
  conditionalRefreshLawId: string;
  tabLifecycleLawId: string;
  apiFocusReturnLawId: string;
};

type UploadStabilityFiles = {
  flowFile: SourceFile;
  orderFile: SourceFile;
  taskServiceFile: SourceFile;
  missionSchemaFile: SourceFile;
  verifyFile: SourceFile;
  existingUploadFile: SourceFile;
  existingEvidenceFile: SourceFile;
  browserControllerFile: SourceFile;
  chromeWindowControlFile: SourceFile;
};

const stringLiteralValues = (file: SourceFile): Set<string> =>
  new Set([
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateHead).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateTail).map((item) => item.getLiteralText()),
  ]);

const propertyValue = (objectLiteral: Node, name: string): string | null => {
  if (!Node.isObjectLiteralExpression(objectLiteral)) return null;
  const property = objectLiteral.getProperties().find((item) =>
    Node.isPropertyAssignment(item) && item.getName() === name);
  if (!property || !Node.isPropertyAssignment(property)) return null;
  const initializer = property.getInitializer();
  return initializer && Node.isStringLiteral(initializer) ? initializer.getLiteralText() : null;
};

const hasConstInitializer = (file: SourceFile, name: string, initializerText: string): boolean =>
  file.getVariableDeclaration(name)?.getInitializer()?.getText() === initializerText;

const functionCallsIdentifier = (file: SourceFile, functionName: string, calleeName: string): boolean =>
  (file.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
    .some((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === calleeName);

const sourceCallsProperty = (file: SourceFile, ownerName: string, methodName: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && Node.isIdentifier(expression.getExpression())
      && expression.getExpression().getText() === ownerName
      && expression.getName() === methodName;
  });

const sourceCallsMethod = (file: SourceFile, methodName: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === methodName;
  });

const retryStepNames = (file: SourceFile): Set<string> =>
  new Set(file.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    if (!Node.isIdentifier(expression) || expression.getText() !== "runUploadStepWithRetries") return [];
    const argument = call.getArguments()[0];
    if (!argument) return [];
    const stepName = propertyValue(argument, "stepName");
    return stepName ? [stepName] : [];
  }));

export const inspectUploadStabilityGuard = (input: UploadStabilityGuardInput): void => {
  const files = resolveUploadStabilityFiles(input);
  if (!files) return;
  const refreshMissing = collectOrderRefreshGuardGaps(files.orderFile);
  appendUploadStabilityFindings(input.findings, input.conditionalRefreshLawId, refreshMissing);
  const missing = collectUploadStabilityGaps(files);
  writeUploadStabilityDebug(missing.length);
  appendUploadStabilityFindings(input.findings, input.lawId, missing);
  const tabLifecycleMissing = collectTabLifecycleGaps(files);
  appendUploadStabilityFindings(input.findings, input.tabLifecycleLawId, tabLifecycleMissing);
  const apiFocusMissing = collectApiFocusReturnGaps(files);
  appendUploadStabilityFindings(input.findings, input.apiFocusReturnLawId, apiFocusMissing);
};

function resolveUploadStabilityFiles(input: UploadStabilityGuardInput): UploadStabilityFiles | null {
  if (!input.flowFile || !input.orderFile || !input.taskServiceFile) return null;
  if (!input.missionSchemaFile || !input.verifyFile || !input.existingUploadFile || !input.existingEvidenceFile) return null;
  if (!input.browserControllerFile || !input.chromeWindowControlFile) return null;
  return {
    flowFile: input.flowFile,
    orderFile: input.orderFile,
    taskServiceFile: input.taskServiceFile,
    missionSchemaFile: input.missionSchemaFile,
    verifyFile: input.verifyFile,
    existingUploadFile: input.existingUploadFile,
    existingEvidenceFile: input.existingEvidenceFile,
    browserControllerFile: input.browserControllerFile,
    chromeWindowControlFile: input.chromeWindowControlFile,
  };
}

function writeUploadStabilityDebug(missingCount: number): void {
  process.stdout.write(
    `[AUDIT][amazon-invoice-upload][upload-stability] checked refresh/retry guards; missing=${missingCount}\n`,
  );
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
    ...collectNoHumanFinalSubmitContractGaps(files.taskServiceFile, files.missionSchemaFile),
    ...collectEnglishUploadEvidenceGaps(files.verifyFile, files.existingUploadFile, files.existingEvidenceFile),
    ...collectExistingInvoiceEvidenceWaitGaps(files.existingUploadFile),
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
  const missing: string[] = [];
  if (!files.taskServiceFile.getFunction("returnApiUploadFocusToAdmin")) missing.push("api-focus-service:return-helper");
  if (!files.taskServiceFile.getFunction("isApiUploadMission")) missing.push("api-focus-service:api-source-guard");
  if (!functionCallsIdentifier(files.taskServiceFile, "startAmazonInvoiceUploadTask", "returnApiUploadFocusToAdmin")) {
    missing.push("api-focus-service:start-call");
  }
  if (!functionCallsIdentifier(files.taskServiceFile, "resumeAmazonInvoiceUploadTask", "returnApiUploadFocusToAdmin")) {
    missing.push("api-focus-service:resume-call");
  }
  if (!functionCallsIdentifier(files.taskServiceFile, "returnApiUploadFocusToAdmin", "openAmazonInvoiceAdminPage")) {
    missing.push("api-focus-service:admin-allowlist-open");
  }
  if (!hasPropertyAssignment(files.taskServiceFile, "focusOnlyExistingTab")) missing.push("api-focus-service:explicit-focus-flag");
  if (!hasTruePropertyAssignment(files.taskServiceFile, "focusOnlyExistingTab")) missing.push("api-focus-service:return-helper-explicit-focus");
  if (!hasFocusOnlyReusePolicyConditional(files.taskServiceFile)) {
    missing.push("api-focus-service:normal-open-not-focus-only");
  }
  if (!taskValues.has("focus-existing-same-path-url")) missing.push("api-focus-service:same-path-focus-only-policy");
  if (!taskValues.has("return API upload focus to website")) missing.push("api-focus-service:runtime-trace");
  return missing;
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
  const flowValues = stringLiteralValues(files.flowFile);
  const orderValues = stringLiteralValues(files.orderFile);
  const verifyValues = stringLiteralValues(files.verifyFile);
  const existingValues = stringLiteralValues(files.existingUploadFile);
  if (!flowValues.has("reuse-active-tab")) missing.push("tab-lifecycle-flow:reuse-active-tab");
  if (!orderValues.has("reuse-active-tab")) missing.push("tab-lifecycle-order:reuse-active-tab");
  if (!flowValues.has("reuse-host-tab")) missing.push("tab-lifecycle-flow:reuse-host-tab");
  if (!orderValues.has("reuse-host-tab")) missing.push("tab-lifecycle-order:reuse-host-tab");
  if (!sourceCallsMethod(files.flowFile, "getGeometrySnapshot")) {
    missing.push("tab-lifecycle-flow:refresh-current-chrome-state");
  }
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
  return item.startsWith("refresh")
    || item === "order-detail-refresh-call"
    || item === "random-refresh-wait";
}

function collectOrderRefreshGuardGaps(orderFile: SourceFile): string[] {
  const orderValues = stringLiteralValues(orderFile);
  const missing: string[] = [];
  if (!hasConstInitializer(orderFile, "ORDER_DETAIL_READY_WAIT_MIN_MS", "7_000")) missing.push("refresh-ready-min-7000");
  if (!hasConstInitializer(orderFile, "ORDER_DETAIL_READY_WAIT_MAX_MS", "15_000")) missing.push("refresh-ready-max-15000");
  if (!orderFile.getVariableDeclaration("ORDER_DETAIL_RECOVERY_REFRESH_WAIT_MIN_MS")) missing.push("refresh-recovery-min");
  if (!orderFile.getVariableDeclaration("ORDER_DETAIL_RECOVERY_REFRESH_WAIT_MAX_MS")) missing.push("refresh-recovery-max");
  if (!functionCallsIdentifier(orderFile, "openApprovedOrderDetail", "waitForApprovedOrderDetail")) {
    missing.push("order-detail-readiness-wait-call");
  }
  if (!functionCallsIdentifier(orderFile, "openApprovedOrderDetail", "refreshApprovedOrderDetailIfNeeded")) {
    missing.push("order-detail-conditional-refresh-call");
  }
  if (orderFile.getFunction("refreshApprovedOrderDetailOnce")) {
    missing.push("order-detail-unconditional-refresh-function");
  }
  if (!sourceCallsProperty(orderFile, "Math", "random")) missing.push("random-refresh-wait");
  const evidenceValues = [
    "Amazon Seller Central approved order detail refresh",
    "refresh approved order detail after readiness timeout",
    "Order detail recovery refresh executed once after missing readiness markers: ",
  ];
  for (const value of evidenceValues) {
    if (!orderValues.has(value)) missing.push(value);
  }
  return missing;
}

function collectNoHumanFinalSubmitContractGaps(taskServiceFile: SourceFile, missionSchemaFile: SourceFile): string[] {
  const missing: string[] = [];
  if (taskServiceFile.getFunction("forceAutomatedFinalSubmit")) {
    missing.push("no-human-final-submit-service:remove-normalizer");
  }
  if (hasPropertyAssignment(taskServiceFile, "requireHumanFinalSubmit")) {
    missing.push("no-human-final-submit-service:hidden-field");
  }
  if (hasPropertyAssignment(missionSchemaFile, "requireHumanFinalSubmit")) {
    missing.push("no-human-final-submit-schema:single-upload");
  }
  if (hasPropertyAssignment(missionSchemaFile, "stopOnManualRequired")) {
    missing.push("no-human-final-submit-schema:batch-stop-switch");
  }
  return missing;
}

function hasPropertyAssignment(file: SourceFile, propertyName: string): boolean {
  return file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === propertyName);
}

function hasTruePropertyAssignment(file: SourceFile, propertyName: string): boolean {
  return file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === propertyName && property.getInitializer()?.getKind() === SyntaxKind.TrueKeyword);
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

function hasTemplateExpressionWithIdentifier(file: SourceFile, identifierName: string): boolean {
  return file.getDescendantsOfKind(SyntaxKind.TemplateExpression).some((template) =>
    template.getTemplateSpans().some((span) => {
      const expression = span.getExpression();
      return Node.isIdentifier(expression) && expression.getText() === identifierName;
    }));
}

function collectEnglishUploadEvidenceGaps(verifyFile: SourceFile, existingUploadFile: SourceFile, existingEvidenceFile: SourceFile): string[] {
  const missing: string[] = [];
  const verifyValues = stringLiteralValues(verifyFile);
  if (!verifyValues.has("./amazon-invoice-upload-existing.js")) missing.push("post-submit-existing-evidence:import");
  if (!functionCallsIdentifier(verifyFile, "verifyUploadSuccess", "verifyAlreadyUploadedInvoice")) {
    missing.push("post-submit-existing-evidence:fallback-call");
  }
  if (!verifyValues.has("already_uploaded")) missing.push("post-submit-existing-evidence:already-uploaded-terminal");
  for (const value of [
    "Thank you for uploading the document",
    "The customer will be able to download it directly from their account",
    "Upload another invoice or credit note",
  ]) {
    if (!verifyValues.has(value)) missing.push(`english-success-evidence:${value}`);
  }
  const existingUploadValues = stringLiteralValues(existingUploadFile);
  if (!existingUploadValues.has("already_uploaded")) {
    missing.push("english-existing-evidence:already-uploaded-terminal");
  }
  const existingValues = stringLiteralValues(existingEvidenceFile);
  for (const value of [
    "Thank you for uploading the document",
    "The customer will be able to download it directly from their account",
    "Seller generated",
  ]) {
    if (!existingValues.has(value)) missing.push(`english-existing-evidence:${value}`);
  }
  const existingHintsText = existingEvidenceFile.getVariableDeclaration("EXISTING_INVOICE_HINTS")?.getInitializer()?.getText() ?? "";
  for (const weakValue of ["Manage invoice", "Manage invoices", "Pending", "管理发票", "待处理"]) {
    if (existingHintsText.includes(weakValue)) missing.push(`weak-existing-evidence-forbidden:${weakValue}`);
  }
  return missing;
}

function collectExistingInvoiceEvidenceWaitGaps(existingUploadFile: SourceFile): string[] {
  const missing: string[] = [];
  if (!hasConstInitializer(existingUploadFile, "existingInvoiceEvidenceTimeoutMs", "45_000")) {
    missing.push("existing-invoice-evidence-timeout-45000");
  }
  if (!hasConstInitializer(existingUploadFile, "existingInvoiceEvidencePollMs", "250")) {
    missing.push("existing-invoice-evidence-poll-250");
  }
  if (!hasConstInitializer(existingUploadFile, "existingInvoiceEvidenceRecoveryAttempts", "1")) {
    missing.push("existing-invoice-evidence-single-recovery");
  }
  if (!hasConstInitializer(existingUploadFile, "existingInvoiceEvidenceRecoverySettleMs", "3_000")) {
    missing.push("existing-invoice-evidence-recovery-settle-3000");
  }
  if (!existingUploadFile.getFunction("recoverExistingInvoiceList")) {
    missing.push("existing-invoice-evidence-recovery-helper");
  }
  return missing;
}

function collectUploadRetryGuardGaps(flowFile: SourceFile): string[] {
  const flowValues = stringLiteralValues(flowFile);
  const missing: string[] = [];
  if (!hasConstInitializer(flowFile, "UPLOAD_STEP_RETRY_LIMIT", "2")) missing.push("retry-limit-2");
  if (!flowFile.getFunction("runUploadStepWithRetries")) missing.push("recursive-retry-function");
  if (!functionCallsIdentifier(flowFile, "runUploadStepWithRetries", "runUploadStepWithRetries")) {
    missing.push("recursive-retry-self-call");
  }
  for (const stepName of ["open order detail", "open upload invoice entry", "upload approved invoice"]) {
    if (!retryStepNames(flowFile).has(stepName)) missing.push(`retry-step:${stepName}`);
  }
  if (!flowValues.has("verify upload success")) missing.push("retry-sensitive-terminal-gates");
  if (hasHumanFinalSubmitBranch(flowValues)) missing.push("human-final-submit-branch");
  for (const value of ["Please upload your invoice or credit note", "Upload"]) {
    if (!flowValues.has(value)) missing.push(`english-upload-copy:${value}`);
  }
  return missing;
}

function hasHumanFinalSubmitBranch(flowValues: ReadonlySet<string>): boolean {
  return flowValues.has("file attached before final submit")
    || flowValues.has("Approved PDF is attached; human final submit is required by mission payload.");
}
