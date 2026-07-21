import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorFinding } from "../../shared/inspector-contracts.js";

type AmountGateInput = {
  flowFile: SourceFile | null;
  amountGateFile: SourceFile | null;
  statusFile: SourceFile | null;
  smokeAcceptanceFile: SourceFile | null;
  smokeAcceptanceSupportFile: SourceFile | null;
  findings: InspectorFinding[];
  lawId: string;
};

const flowPath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload.flow.ts";
const amountGatePath = "src/plugins/amazon-invoice-upload/amazon-invoice-upload-amount-check.ts";
const statusPath = "src/plugins/amazon-invoice-upload/amazon-result-detector.ts";
const smokeAcceptancePath = "scripts/acceptance/amazon-invoice-upload-smoke.ts";

export function inspectAmazonInvoiceAmountGate(input: AmountGateInput): void {
  const missing = [
    ...collectFlowGaps(input.flowFile),
    ...collectAmountFileGaps(input.amountGateFile),
    ...collectStatusGaps(input.statusFile),
    ...collectAcceptanceGaps([input.smokeAcceptanceFile, input.smokeAcceptanceSupportFile]),
  ];
  for (const item of missing) {
    input.findings.push(createFinding({
      checkId: "amazon-invoice-upload/amount-pre-upload-gate",
      lawId: input.lawId,
      filePath: findingPath(item),
      message: `Amazon invoice amount pre-upload hard gate missing: ${item}.`,
    }));
  }
}

function collectFlowGaps(file: SourceFile | null): string[] {
  if (!file) return ["flow:file-missing"];
  const missing: string[] = [];
  const continueFunction = file.getFunction("continueInvoiceUpload");
  if (!continueFunction) return ["flow:continue-function"];
  const calls = callPositions(continueFunction, [
    "verifyAlreadyUploadedInvoice",
    "verifyInvoiceAmountBeforeUpload",
    "openUploadInvoiceEntry",
  ]);
  if (calls.verifyAlreadyUploadedInvoice === undefined) missing.push("flow:already-uploaded-call");
  if (calls.verifyInvoiceAmountBeforeUpload === undefined) missing.push("flow:amount-gate-call");
  if (calls.openUploadInvoiceEntry === undefined) missing.push("flow:upload-entry-call");
  if (
    calls.verifyAlreadyUploadedInvoice !== undefined
    && calls.verifyInvoiceAmountBeforeUpload !== undefined
    && calls.openUploadInvoiceEntry !== undefined
    && !(calls.verifyAlreadyUploadedInvoice < calls.verifyInvoiceAmountBeforeUpload
      && calls.verifyInvoiceAmountBeforeUpload < calls.openUploadInvoiceEntry)
  ) {
    missing.push("flow:amount-gate-order");
  }
  return missing;
}

function collectAmountFileGaps(file: SourceFile | null): string[] {
  if (!file) return ["amount:file-missing"];
  const values = stringLiteralValues(file);
  const missing: string[] = [];
  for (const exported of ["verifyInvoiceAmountBeforeUpload", "extractInvoicePdfTotalAmount", "extractOrderDomTotalAmount"]) {
    if (!file.getFunction(exported)) missing.push(`amount:${exported}`);
  }
  for (const required of ["PDFParse", "Gross amount payable", "总和", "amount_mismatch_skipped", "verify invoice amount against order total"]) {
    if (!values.has(required) && !identifierExists(file, required)) missing.push(`amount:${required}`);
  }
  if (!hasTrueProperty(file, "reviewRequired")) missing.push("amount:review-required");
  if (sourceCallsProperty(file, "console", "log")) missing.push("amount:no-console-log");
  return missing;
}

function collectStatusGaps(file: SourceFile | null): string[] {
  if (!file) return ["status:file-missing"];
  return stringLiteralValues(file).has("amount_mismatch_skipped") ? [] : ["status:amount-mismatch-skipped"];
}

function collectAcceptanceGaps(files: readonly (SourceFile | null)[]): string[] {
  const presentFiles = files.filter((file): file is SourceFile => file !== null);
  if (presentFiles.length !== files.length) return ["acceptance:file-missing"];
  const values = new Set(presentFiles.flatMap((file) => [...stringLiteralValues(file)]));
  const missing: string[] = [];
  for (const value of ["amount_mismatch_skipped", "fileInputSetCalls", "Gross amount payable", "AED 59.50", "39.07"]) {
    if (!literalsContain(values, value) && !presentFiles.some((file) => identifierExists(file, value))) missing.push(`acceptance:${value}`);
  }
  return missing;
}

function callPositions(functionNode: Node, names: string[]): Record<string, number | undefined> {
  const wanted = new Set(names);
  const positions: Record<string, number | undefined> = {};
  for (const call of functionNode.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    const name = Node.isIdentifier(expression)
      ? expression.getText()
      : Node.isPropertyAccessExpression(expression) ? expression.getName() : null;
    if (name && wanted.has(name) && positions[name] === undefined) {
      positions[name] = call.getStart();
    }
  }
  return positions;
}

function stringLiteralValues(file: SourceFile): Set<string> {
  return new Set([
    ...file.getDescendantsOfKind(SyntaxKind.StringLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateHead).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateMiddle).map((item) => item.getLiteralText()),
    ...file.getDescendantsOfKind(SyntaxKind.TemplateTail).map((item) => item.getLiteralText()),
  ]);
}

function identifierExists(file: SourceFile, text: string): boolean {
  return file.getDescendantsOfKind(SyntaxKind.Identifier).some((item) => item.getText() === text);
}

function literalsContain(values: ReadonlySet<string>, text: string): boolean {
  return [...values].some((value) => value.includes(text));
}

function hasTrueProperty(file: SourceFile, propertyName: string): boolean {
  return file.getDescendantsOfKind(SyntaxKind.PropertyAssignment).some((property) =>
    property.getName() === propertyName && property.getInitializer()?.getKind() === SyntaxKind.TrueKeyword);
}

function sourceCallsProperty(file: SourceFile, ownerName: string, methodName: string): boolean {
  return file.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) => {
    const expression = call.getExpression();
    return Node.isPropertyAccessExpression(expression)
      && Node.isIdentifier(expression.getExpression())
      && expression.getExpression().getText() === ownerName
      && expression.getName() === methodName;
  });
}

function findingPath(item: string): string {
  if (item.startsWith("flow:")) return flowPath;
  if (item.startsWith("status:")) return statusPath;
  if (item.startsWith("acceptance:")) return smokeAcceptancePath;
  return amountGatePath;
}
