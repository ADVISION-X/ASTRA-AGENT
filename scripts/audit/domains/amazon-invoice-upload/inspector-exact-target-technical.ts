import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
import { createFinding } from "../../shared/finding-utils.js";
import type { InspectorContext, InspectorFinding } from "../../shared/inspector-contracts.js";
import { resolveFromRepo } from "../../shared/paths.js";

const ownerRoot = "src/plugins/amazon-invoice-upload";
const paths = {
  order: `${ownerRoot}/amazon-invoice-upload-order-detail.ts`,
  steps: `${ownerRoot}/amazon-invoice-upload-steps.ts`,
  attachment: `${ownerRoot}/amazon-invoice-upload-file-attachment.ts`,
  verify: `${ownerRoot}/amazon-invoice-upload-verify.ts`,
  existing: `${ownerRoot}/amazon-invoice-upload-existing.ts`,
  evidence: `${ownerRoot}/amazon-existing-invoice-evidence.ts`,
  smoke: "scripts/acceptance/amazon-invoice-upload-smoke.ts",
  smokeSupport: "scripts/acceptance/amazon-invoice-upload-smoke-support.ts",
  smokeBoundary: "scripts/acceptance/amazon-invoice-upload-smoke-boundary.ts",
} as const;

type TechnicalFiles = Readonly<Record<keyof typeof paths, SourceFile>>;

const loadFiles = (context: InspectorContext): { files: TechnicalFiles | null; missing: string[] } => {
  const entries = Object.entries(paths).map(([key, filePath]) => [
    key,
    context.project.getSourceFile(resolveFromRepo(filePath)),
  ] as const);
  const missing = entries.filter(([, file]) => !file).map(([key]) => paths[key as keyof typeof paths]);
  return {
    files: missing.length === 0 ? Object.fromEntries(entries) as TechnicalFiles : null,
    missing,
  };
};

const inspectOrderObservation = (
  files: TechnicalFiles,
  add: (filePath: string, message: string) => void,
): void => {
  const observationNode = files.order.getVariableDeclaration("observeOrderDetailOnce")?.getInitializer();
  const observationLiterals = new Set(observationNode?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? []);
  if (!observationLiterals.has("technical_failure")) {
    add(paths.order, "order-detail observation exceptions must return a distinct technical_failure branch");
  }
  const technicalBuilder = files.order.getVariableDeclaration("buildOrderDetailTechnicalFailureResult")?.getInitializer();
  const technicalLiterals = new Set(technicalBuilder?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? []);
  if (!technicalLiterals.has("review_required") || !technicalLiterals.has("observe approved order detail readiness")) {
    add(paths.order, "technical observation failure must fail closed as review_required before later upload actions");
  }
  const openLiterals = new Set(files.order.getFunction("openApprovedOrderDetail")
    ?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? []);
  if (!openLiterals.has("technical_failure")) {
    add(paths.order, "openApprovedOrderDetail must terminate on the technical_failure readiness branch");
  }
  const privateConstructors = files.smokeSupport.getDescendantsOfKind(SyntaxKind.NewExpression).filter((node) =>
    Node.isIdentifier(node.getExpression()) && astIdentifierName(node.getExpression()) === "Function");
  const privateEvalCalls = files.smokeSupport.getDescendantsOfKind(SyntaxKind.CallExpression).filter((node) =>
    Node.isIdentifier(node.getExpression()) && astIdentifierName(node.getExpression()) === "eval");
  const normalizerCalls = files.smokeSupport.getDescendantsOfKind(SyntaxKind.CallExpression).filter((node) =>
    Node.isIdentifier(node.getExpression()) && astIdentifierName(node.getExpression()) === "toBrowserEvaluationExpression");
  if (privateConstructors.length || privateEvalCalls.length || normalizerCalls.length !== 1) {
    add(paths.smokeSupport, "Amazon smoke must call the unique production evaluation normalizer exactly once and contain no private evaluator");
  }
};

const inspectUploadEntry = (
  files: TechnicalFiles,
  add: (filePath: string, message: string) => void,
): void => {
  const openUploadEntry = files.steps.getFunction("openUploadInvoiceEntry");
  const callNamed = (name: string) => openUploadEntry?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .find((node) => Node.isIdentifier(node.getExpression()) && astIdentifierName(node.getExpression()) === name);
  const readyCall = callNamed("snapshotHasCurrentUploadDialog");
  const locateCall = callNamed("locateUploadInvoiceButton");
  if (!readyCall || !locateCall || readyCall.getStart() >= locateCall.getStart()) {
    add(paths.steps, "current-order upload dialog readiness must short-circuit before retry location or click of the covered page entry");
  }
  const currentDialogHelper = files.steps.getFunction("snapshotHasCurrentUploadDialog");
  const helperIdentifiers = new Set(currentDialogHelper?.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()) ?? []);
  for (const required of ["dialogs", "fileInputs", "amazonOrderId", "hidden", "disabled"]) {
    if (!helperIdentifiers.has(required)) add(paths.steps, `current-order upload dialog readiness is missing ${required}`);
  }
  const smokeIdentifiers = new Set([
    ...files.smokeSupport.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()),
    ...files.smoke.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()),
  ]);
  const smokeNumbers = new Set(files.smokeSupport.getDescendantsOfKind(SyntaxKind.NumericLiteral).map((node) => node.getLiteralValue()));
  if (!smokeIdentifiers.has("uploadInvoiceClickCount") || !smokeNumbers.has(2_300)) {
    add(paths.smokeSupport, "Amazon smoke must reproduce the observed delayed upload-dialog race and count page-entry clicks");
  }
};

const inspectFileAttachment = (
  files: TechnicalFiles,
  add: (filePath: string, message: string) => void,
): void => {
  if (files.attachment.getVariableDeclaration("waitForAttachedInvoice") || files.attachment.getImportDeclarations().some((declaration) =>
    declaration.getNamedImports().some((namedImport) => namedImport.getName() === "waitForState"))) {
    add(paths.attachment, "whole-page text polling must not survive as file-attachment proof");
  }
  const identifiers = new Set(files.attachment.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
  const literals = new Set(files.attachment.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()));
  for (const required of ["waitForAmazonReadyFileItem", "observeAmazonReadyFileItem", "afterEvidenceRef", "basename", "FILE_ITEM_READY_OBSERVATION_LIMIT", "AMAZON_TERMINAL_FILE_STATUSES"]) {
    if (!identifiers.has(required)) add(paths.attachment, `Amazon file attachment gate is missing ${required}`);
  }
  for (const required of ["verify file attached", "kat-file-item", "file-status", "ready", "confirmed", "rejected", "pending", "error", "failed", "invalid"]) {
    if (!literals.has(required)) add(paths.attachment, `Amazon file attachment gate is missing ${required}`);
  }
  const uploadApprovedPdf = files.attachment.getVariableDeclaration("uploadApprovedPdf")?.getInitializer();
  const gated = uploadApprovedPdf?.getDescendantsOfKind(SyntaxKind.CallExpression).some((call) =>
    Node.isIdentifier(call.getExpression()) && astIdentifierName(call.getExpression()) === "waitForAmazonReadyFileItem");
  if (!gated) add(paths.attachment, "invoice-number fill must be gated by the Amazon same-name ready file item and its after evidence");
};

const inspectFinalConfirmation = (
  files: TechnicalFiles,
  add: (filePath: string, message: string) => void,
): void => {
  const verifyIdentifiers = new Set(files.verify.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
  const verifyNumbers = new Set(files.verify.getDescendantsOfKind(SyntaxKind.NumericLiteral).map((node) => node.getLiteralValue()));
  for (const required of ["waitForUploadSuccessBoundary", "captureFinalBoundaryEvidence", "observeExistingInvoiceConfirmation", "screenshotRegion", "sourceFilePath", "UPLOAD_SUCCESS_OBSERVATION_LIMIT"]) {
    if (!verifyIdentifiers.has(required)) add(paths.verify, `Amazon final confirmation boundary is missing ${required}`);
  }
  if (!verifyNumbers.has(40) || files.verify.getDescendantsOfKind(SyntaxKind.WhileStatement).length > 0) {
    add(paths.verify, "Amazon final confirmation must use forty bounded observations and no while loop");
  }
  const evidenceIdentifiers = new Set(files.evidence.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()));
  for (const required of ["observeExistingInvoiceConfirmation", "dialogs", "currentOrderDialogs", "descendantRows", "matchingRows", "successfulRows", "hasExactInvoiceNumber", "hasExplicitSuccessfulInvoiceState", "hasFailureState", "hasInvoiceRowContext"]) {
    if (!evidenceIdentifiers.has(required)) add(paths.evidence, `Amazon inclusion/exclusion classifier is missing ${required}`);
  }
  const unbounded = files.existing.getDescendantsOfKind(SyntaxKind.WhileStatement)
    .some((statement) => statement.getExpression().getKind() === SyntaxKind.TrueKeyword)
    || files.existing.getDescendantsOfKind(SyntaxKind.ForStatement).some((statement) => statement.getCondition() === undefined);
  if (unbounded) add(paths.existing, "Amazon current-order invoice observation must not contain an unconditional loop");
  const boundary = files.smokeBoundary.getFunction("assertPositiveAndNegativeConfirmationBoundary");
  const literals = boundary?.getDescendantsOfKind(SyntaxKind.StringLiteral).map((node) => node.getLiteralText()) ?? [];
  for (const required of ["confirmed", "rejected", "pending", "INV-FOREIGN", "INV-BOUNDARY-EXTRA", "文件上传失败"]) {
    if (!literals.some((literal) => literal.includes(required))) add(paths.smokeBoundary, `Amazon confirmation-boundary attack is missing ${required}`);
  }
  const boundaryIdentifiers = new Set(boundary?.getDescendantsOfKind(SyntaxKind.Identifier).map((node) => node.getText()) ?? []);
  for (const required of ["outsideDialogRow", "orderIdOnly", "partialInvoice", "missingSuccessState", "hiddenDialog"]) {
    if (!boundaryIdentifiers.has(required)) add(paths.smokeBoundary, `Amazon confirmation-boundary attack is missing ${required}`);
  }
};

export const inspectExactTargetTechnicalIntegrity = (
  context: InspectorContext,
  findings: InspectorFinding[],
  lawId: string,
): void => {
  const add = (filePath: string, message: string): void => {
    findings.push(createFinding({
      checkId: "amazon-invoice-upload/exact-target-technical-integrity",
      lawId,
      filePath,
      message,
    }));
  };
  const loaded = loadFiles(context);
  for (const missingPath of loaded.missing) add(missingPath, "required Amazon exact-target technical file is missing");
  const files = loaded.files;
  if (!files) return;
  inspectOrderObservation(files, add);
  inspectUploadEntry(files, add);
  inspectFileAttachment(files, add);
  inspectFinalConfirmation(files, add);
};
