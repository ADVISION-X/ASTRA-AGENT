import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

const uploadFlowPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts";
const orderDetailPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-order-detail.ts";
const taskServicePath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts";
const missionSchemaPath = "src/plugins/amazon-invoice-upload/mission.schema.ts";
const verifyPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-verify.ts";
const existingEvidencePath = "src/plugins/amazon-invoice-upload/amazon-existing-invoice-evidence.ts";

type UploadStabilityGuardInput = {
  flowFile: SourceFile | null;
  orderFile: SourceFile | null;
  taskServiceFile: SourceFile | null;
  missionSchemaFile: SourceFile | null;
  verifyFile: SourceFile | null;
  existingEvidenceFile: SourceFile | null;
  findings: InspectorFinding[];
  lawId: string;
};

type UploadStabilityFiles = {
  flowFile: SourceFile;
  orderFile: SourceFile;
  taskServiceFile: SourceFile;
  missionSchemaFile: SourceFile;
  verifyFile: SourceFile;
  existingEvidenceFile: SourceFile;
};

const stringLiteralValues = (file: SourceFile): Set<string> =>
  new Set([
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
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
  const missing = collectUploadStabilityGaps(files);
  writeUploadStabilityDebug(missing.length);
  appendUploadStabilityFindings(input.findings, input.lawId, missing);
};

function resolveUploadStabilityFiles(input: UploadStabilityGuardInput): UploadStabilityFiles | null {
  if (!input.flowFile || !input.orderFile || !input.taskServiceFile) return null;
  if (!input.missionSchemaFile || !input.verifyFile || !input.existingEvidenceFile) return null;
  return {
    flowFile: input.flowFile,
    orderFile: input.orderFile,
    taskServiceFile: input.taskServiceFile,
    missionSchemaFile: input.missionSchemaFile,
    verifyFile: input.verifyFile,
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
    ...collectOrderRefreshGuardGaps(files.orderFile),
    ...collectUploadRetryGuardGaps(files.flowFile),
    ...collectNoHumanFinalSubmitContractGaps(files.taskServiceFile, files.missionSchemaFile),
    ...collectEnglishUploadEvidenceGaps(files.verifyFile, files.existingEvidenceFile),
  ];
}

function uploadStabilityFindingPath(item: string): string {
  if (item.startsWith("english-success-evidence")) return verifyPath;
  if (item.startsWith("english-existing-evidence")) return existingEvidencePath;
  if (item.startsWith("no-human-final-submit-schema")) return missionSchemaPath;
  if (item.startsWith("no-human-final-submit-service")) return taskServicePath;
  if (isOrderRefreshFinding(item)) return orderDetailPath;
  return uploadFlowPath;
}

function isOrderRefreshFinding(item: string): boolean {
  return item.startsWith("refresh")
    || item === "order-detail-refresh-call"
    || item === "random-refresh-wait";
}

function collectOrderRefreshGuardGaps(orderFile: SourceFile): string[] {
  const orderValues = stringLiteralValues(orderFile);
  const missing: string[] = [];
  if (!hasConstInitializer(orderFile, "ORDER_DETAIL_REFRESH_WAIT_MIN_MS", "3_000")) missing.push("refresh-min-3000");
  if (!hasConstInitializer(orderFile, "ORDER_DETAIL_REFRESH_WAIT_MAX_MS", "6_000")) missing.push("refresh-max-6000");
  if (!functionCallsIdentifier(orderFile, "openApprovedOrderDetail", "refreshApprovedOrderDetailOnce")) {
    missing.push("order-detail-refresh-call");
  }
  if (!sourceCallsProperty(orderFile, "Math", "random")) missing.push("random-refresh-wait");
  const evidenceValues = [
    "Amazon Seller Central approved order detail refresh",
    "refresh approved order detail before upload",
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

function collectEnglishUploadEvidenceGaps(verifyFile: SourceFile, existingEvidenceFile: SourceFile): string[] {
  const missing: string[] = [];
  const verifyValues = stringLiteralValues(verifyFile);
  for (const value of [
    "Thank you for uploading the document",
    "The customer will be able to download it directly from their account",
    "Manage invoice",
    "Upload another invoice or credit note",
  ]) {
    if (!verifyValues.has(value)) missing.push(`english-success-evidence:${value}`);
  }
  const existingValues = stringLiteralValues(existingEvidenceFile);
  for (const value of [
    "Thank you for uploading the document",
    "The customer will be able to download it directly from their account",
    "Seller generated",
    "Manage invoice",
  ]) {
    if (!existingValues.has(value)) missing.push(`english-existing-evidence:${value}`);
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
