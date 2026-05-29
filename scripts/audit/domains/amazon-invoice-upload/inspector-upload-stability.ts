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

type UploadStabilityGuardInput = {
  flowFile: SourceFile | null;
  orderFile: SourceFile | null;
  taskServiceFile: SourceFile | null;
  missionSchemaFile: SourceFile | null;
  verifyFile: SourceFile | null;
  existingUploadFile: SourceFile | null;
  existingEvidenceFile: SourceFile | null;
  findings: InspectorFinding[];
  lawId: string;
  conditionalRefreshLawId: string;
  tabLifecycleLawId: string;
};

type UploadStabilityFiles = {
  flowFile: SourceFile;
  orderFile: SourceFile;
  taskServiceFile: SourceFile;
  missionSchemaFile: SourceFile;
  verifyFile: SourceFile;
  existingUploadFile: SourceFile;
  existingEvidenceFile: SourceFile;
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
};

function resolveUploadStabilityFiles(input: UploadStabilityGuardInput): UploadStabilityFiles | null {
  if (!input.flowFile || !input.orderFile || !input.taskServiceFile) return null;
  if (!input.missionSchemaFile || !input.verifyFile || !input.existingUploadFile || !input.existingEvidenceFile) return null;
  return {
    flowFile: input.flowFile,
    orderFile: input.orderFile,
    taskServiceFile: input.taskServiceFile,
    missionSchemaFile: input.missionSchemaFile,
    verifyFile: input.verifyFile,
    existingUploadFile: input.existingUploadFile,
    existingEvidenceFile: input.existingEvidenceFile,
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
  ];
}

function uploadStabilityFindingPath(item: string): string {
  const tabLifecyclePath = tabLifecycleFindingPath(item);
  if (tabLifecyclePath) return tabLifecyclePath;
  if (item.startsWith("english-success-evidence")) return verifyPath;
  if (item.startsWith("english-existing-evidence")) return existingEvidencePath;
  if (item.startsWith("no-human-final-submit-schema")) return missionSchemaPath;
  if (item.startsWith("no-human-final-submit-service")) return taskServicePath;
  if (isOrderRefreshFinding(item)) return orderDetailPath;
  return uploadFlowPath;
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
