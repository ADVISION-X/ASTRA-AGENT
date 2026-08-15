import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { hasConstInitializer } from "./inspector-upload-runtime-stability.js";

export const stringLiteralValues = (file: SourceFile): Set<string> =>
  new Set([
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateHead).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateTail).map((item) => item.getLiteralText()),
  ])

const propertyValue = (objectLiteral: Node, name: string): string | null => {
  if (!Node.isObjectLiteralExpression(objectLiteral)) return null;
  const property = objectLiteral.getProperties().find((item) =>
    Node.isPropertyAssignment(item) && item.getName() === name);
  if (!property || !Node.isPropertyAssignment(property)) return null;
  const initializer = property.getInitializer();
  return initializer && Node.isStringLiteral(initializer) ? initializer.getLiteralText() : null;
}

export const functionCallsIdentifier = (file: SourceFile, functionName: string, calleeName: string): boolean =>
  (file.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
    .some((call) => Node.isIdentifier(call.getExpression()) && astIdentifierName(call.getExpression()) === calleeName)

const functionIdentifierCallCount = (file: SourceFile, functionName: string, calleeName: string): number =>
  (file.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
    .filter((call) => Node.isIdentifier(call.getExpression()) && astIdentifierName(call.getExpression()) === calleeName)
    .length

export const functionCallsProperty = (file: SourceFile, functionName: string, ownerName: string, methodName: string): boolean =>
  (file.getFunction(functionName)?.getDescendantsOfKind(SyntaxKind.CallExpression) ?? [])
  .some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && Node.isIdentifier(expression.getExpression())
      && astIdentifierName(expression.getExpression()) === ownerName
      && expression.getName() === methodName;
  })

export const sourceCallsProperty = (file: SourceFile, ownerName: string, methodName: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && Node.isIdentifier(expression.getExpression())
      && astIdentifierName(expression.getExpression()) === ownerName
      && expression.getName() === methodName;
  })

export const sourceCallsMethod = (file: SourceFile, methodName: string): boolean =>
  file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression) && expression.getName() === methodName;
  })

export const retryStepNames = (file: SourceFile): Set<string> =>
  new Set(file.getDescendantsOfKind(SyntaxKind.CallExpression).flatMap((call) => {
    const expression = call.getExpression();
    if (!Node.isIdentifier(expression) || astIdentifierName(expression) !== "runUploadStepWithRetries") return [];
    const argument = call.getArguments()[0];
    if (!argument) return [];
    const stepName = propertyValue(argument, "stepName");
    return stepName ? [stepName] : [];
  }))

export function collectNoHumanFinalSubmitContractGaps(taskServiceFile: SourceFile, missionSchemaFile: SourceFile): string[] {
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

export function hasPropertyAssignment(file: SourceFile, propertyName: string): boolean {
  return file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === propertyName);
}

export function hasObjectProperty(file: SourceFile, propertyName: string): boolean {
  return file.getDescendants().some((node) =>
    (Node.isPropertyAssignment(node) || Node.isShorthandPropertyAssignment(node))
      && node.getName() === propertyName);
}

export function collectEnglishUploadEvidenceGaps(verifyFile: SourceFile, existingUploadFile: SourceFile, existingEvidenceFile: SourceFile): string[] {
  const missing: string[] = [];
  if (!functionCallsIdentifier(verifyFile, "waitForUploadSuccessBoundary", "observeExistingInvoiceConfirmation")) {
    missing.push("post-submit-confirmation-boundary:owner-call");
  }
  const existingValues = stringLiteralValues(existingEvidenceFile);
  for (const value of [
    "Seller generated",
    "Generated by seller",
    "由卖家生成",
    "Upload another invoice or credit note",
  ]) {
    if (!existingValues.has(value)) missing.push(`english-success-evidence:${value}`);
  }
  const existingUploadValues = stringLiteralValues(existingUploadFile);
  if (!existingUploadValues.has("already_uploaded")) {
    missing.push("english-existing-evidence:already-uploaded-terminal");
  }
  for (const value of [
    "Seller generated",
    "Generated by seller",
    "由卖家生成",
  ]) {
    if (!existingValues.has(value)) missing.push(`english-existing-evidence:${value}`);
  }
  const existingHints = new Set(
    existingEvidenceFile
      .getVariableDeclaration("SUCCESSFUL_INVOICE_ROW_STATES")
      ?.getInitializer()
      ?.getDescendantsOfKind(SyntaxKind.StringLiteral)
      .map((literal) => literal.getLiteralText()) ?? [],
  );
  for (const weakValue of ["Manage invoice", "Manage invoices", "Pending", "管理发票", "待处理"]) {
    if (existingHints.has(weakValue)) missing.push(`weak-existing-evidence-forbidden:${weakValue}`);
  }
  for (const functionName of [
    "hasExistingInvoiceEvidence",
    "observeExistingInvoiceConfirmation",
    "findOrderBoundInvoiceDialogText",
    "hasInvoiceDialogReadyForUpload",
  ]) {
    if (!existingEvidenceFile.getFunction(functionName)) missing.push(`existing-invoice-and-then-detector:${functionName}`);
  }
  for (const value of ["订单", "的发票", "成功：已上传", "上传其他发票或贷记单"]) {
    if (!existingValues.has(value)) missing.push(`existing-invoice-real-chrome-signal:${value}`);
  }
  return missing;
}

export function collectExistingInvoiceEvidenceWaitGaps(existingUploadFile: SourceFile): string[] {
  return [
    ...collectExistingInvoiceTimingAndSymbolGaps(existingUploadFile),
    ...collectExistingInvoiceRecoveryCallGaps(existingUploadFile),
    ...collectRetiredExistingInvoiceRecoveryGaps(existingUploadFile),
  ];
}

function collectExistingInvoiceTimingAndSymbolGaps(existingUploadFile: SourceFile): string[] {
  const missing: string[] = [];
  if (existingUploadFile.getVariableDeclaration("existingInvoiceEvidenceTimeoutMs"))
    missing.push("existing-invoice-short-business-timeout-forbidden");
  if (!hasConstInitializer(existingUploadFile, "existingInvoiceEvidencePollMs", 250))
    missing.push("existing-invoice-evidence-poll-250");
  if (!hasConstInitializer(existingUploadFile, "INVOICE_DIALOG_READY_CONFIRMATION_COUNT", 2))
    missing.push("existing-invoice-ready-confirmation-count-2");
  if (!hasConstInitializer(existingUploadFile, "noAvailableActionsDialogDismissTimeoutMs", 2_000))
    missing.push("existing-invoice-no-actions-dismiss-timeout-2000");
  const blockerInitializer = existingUploadFile.getVariableDeclaration("noAvailableActionsDialogText")
    ?.getInitializerIfKind(SyntaxKind.StringLiteral);
  if (blockerInitializer?.getLiteralText() !== "很抱歉，目前没有可用的操作。")
    missing.push("existing-invoice-exact-no-actions-dialog-text");
  const readFailureInitializer = existingUploadFile.getVariableDeclaration("invoiceReadFailureDialogText")
    ?.getInitializerIfKind(SyntaxKind.StringLiteral);
  if (readFailureInitializer?.getLiteralText() !== "读取失败")
    missing.push("existing-invoice-exact-read-failure-dialog-text");
  for (const functionName of [
    "dismissInvoiceReadFailureDialog",
    "clickSafeOutsideDialogPoint",
    "waitForInvoiceReadFailureDialogDismissal",
    "findInvoiceReadFailureDialogText",
  ]) {
    if (!existingUploadFile.getFunction(functionName)) missing.push(`existing-invoice-no-actions-helper:${functionName}`);
  }
  const waitFunction = existingUploadFile.getFunction("waitForExistingInvoiceEvidence");
  if (!waitFunction?.getParameters().some((parameter) => parameter.getName() === "abortSignal")) {
    missing.push("existing-invoice-and-then-abort-signal");
  }
  if (!functionCallsIdentifier(existingUploadFile, "waitForExistingInvoiceEvidence", "hasExistingInvoiceEvidence")) {
    missing.push("existing-invoice-and-then-uploaded-branch");
  }
  if (!functionCallsIdentifier(existingUploadFile, "waitForExistingInvoiceEvidence", "hasInvoiceDialogReadyForUpload")) {
    missing.push("existing-invoice-and-then-upload-ready-branch");
  }
  const waitValues = stringLiteralValuesFromNode(waitFunction);
  if (!waitValues.has("ready_for_upload") || waitValues.has("timeout")) {
    missing.push("existing-invoice-and-then-no-short-timeout-verdict");
  }
  return missing;
}

function stringLiteralValuesFromNode(node: Node | undefined): Set<string> {
  return new Set([
    ...(node?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()) ?? []),
    ...(node?.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()) ?? []),
  ]);
}

function collectExistingInvoiceRecoveryCallGaps(existingUploadFile: SourceFile): string[] {
  const missing: string[] = [];
  if (functionIdentifierCallCount(existingUploadFile, "recoverInvoiceReadFailure", "dismissInvoiceReadFailureDialog") !== 1)
    missing.push("existing-invoice-single-dialog-dismiss-call");
  if (functionIdentifierCallCount(existingUploadFile, "verifyAlreadyUploadedInvoice", "recoverInvoiceReadFailure") !== 1
    || functionIdentifierCallCount(existingUploadFile, "verifyAlreadyUploadedInvoice", "openManageInvoiceList") !== 1
    || functionIdentifierCallCount(existingUploadFile, "recoverInvoiceReadFailure", "openManageInvoiceList") !== 1)
    missing.push("existing-invoice-single-manage-reopen-call");
  if (!functionCallsIdentifier(existingUploadFile, "waitForExistingInvoiceEvidence", "findInvoiceReadFailureDialogText"))
    missing.push("existing-invoice-wait-detects-read-failure-dialog");
  if (!functionCallsIdentifier(existingUploadFile, "findInvoiceReadFailureDialogText", "findOrderBoundInvoiceDialogText"))
    missing.push("existing-invoice-read-failure-must-bind-current-order-dialog");
  if (!functionCallsProperty(existingUploadFile, "clickSafeOutsideDialogPoint", "browser", "evaluate"))
    missing.push("existing-invoice-live-dialog-click-evaluation");
  if (!functionCallsIdentifier(existingUploadFile, "dismissInvoiceReadFailureDialog", "clickSafeOutsideDialogPoint"))
    missing.push("existing-invoice-outside-dialog-click");
  if (!functionCallsIdentifier(existingUploadFile, "dismissInvoiceReadFailureDialog", "waitForInvoiceReadFailureDialogDismissal"))
    missing.push("existing-invoice-dialog-dismissal-verification");
  return missing;
}

function collectRetiredExistingInvoiceRecoveryGaps(existingUploadFile: SourceFile): string[] {
  const missing: string[] = [];
  if (existingUploadFile.getFunction("recoverExistingInvoiceList")) {
    missing.push("existing-invoice-retired-order-refresh-helper-forbidden");
  }
  for (const retiredConstant of ["existingInvoiceEvidenceRecoveryAttempts", "existingInvoiceEvidenceRecoverySettleMs"]) {
    if (existingUploadFile.getVariableDeclaration(retiredConstant)) {
      missing.push(`existing-invoice-retired-order-refresh-constant-forbidden:${retiredConstant}`);
    }
  }
  if (sourceCallsProperty(existingUploadFile, "browser", "open")) {
    missing.push("existing-invoice-order-detail-refresh-forbidden");
  }
  return missing;
}

export function collectUploadRetryGuardGaps(flowFile: SourceFile): string[] {
  const flowValues = stringLiteralValues(flowFile);
  const missing: string[] = [];
  if (!hasConstInitializer(flowFile, "UPLOAD_STEP_RETRY_LIMIT", 2)) missing.push("retry-limit-2");
  if (!flowFile.getFunction("runUploadStepWithRetries")) missing.push("recursive-retry-function");
  if (!functionCallsIdentifier(flowFile, "runUploadStepWithRetries", "runUploadStepWithRetries")) {
    missing.push("recursive-retry-self-call");
  }
  for (const stepName of ["open upload invoice entry", "upload approved invoice"]) {
    if (!retryStepNames(flowFile).has(stepName)) missing.push(`retry-step:${stepName}`);
  }
  if (retryStepNames(flowFile).has("open order detail")) missing.push("repeat-order-navigation-retry-forbidden");
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
