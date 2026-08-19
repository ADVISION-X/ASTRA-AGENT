import { Node, SyntaxKind, type SourceFile } from "ts-morph";

import { astIdentifierName } from "../../shared/ast-node-identity.js";
export type UploadRuntimeStabilityFiles = {
  flowFile: SourceFile;
  flowSupportFile: SourceFile;
  orderFile: SourceFile;
  stepsFile: SourceFile;
  fileAttachmentFile: SourceFile;
  verifyFile: SourceFile;
  chromeScreenshotFile: SourceFile;
};

export const hasConstInitializer = (file: SourceFile, name: string, initializerValue: number): boolean => {
  const initializer = file.getVariableDeclaration(name)?.getInitializer();
  return Boolean(initializer && Node.isNumericLiteral(initializer)
    && Number(initializer.getLiteralValue()) === initializerValue);
};

export function collectUploadRuntimeStabilityGaps(files: UploadRuntimeStabilityFiles): string[] {
  const missing: string[] = [];
  if (!hasConstInitializer(files.flowSupportFile, "AMAZON_INVOICE_SNAPSHOT_TIMEOUT_MS", 1_800)) {
    missing.push("snapshot-deadline-flow-support:1800ms");
  }
  if (!(files.flowSupportFile.getVariableDeclaration("readSnapshot")?.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => astIdentifierName(identifier) === "AMAZON_INVOICE_SNAPSHOT_TIMEOUT_MS") ?? false)) {
    missing.push("snapshot-deadline-flow-support:explicit-timeout");
  }
  if (!(files.orderFile.getVariableDeclaration("observeOrderDetailOnce")?.getDescendantsOfKind(SyntaxKind.CatchClause).length)) {
    missing.push("snapshot-deadline-order-detail:structured-exception");
  }
  const screenshotValues = new Set(files.chromeScreenshotFile
    .getDescendantsOfKind(SyntaxKind.Identifier)
    .map((identifier) => identifier.getText()));
  const screenshotLiterals = new Set(files.chromeScreenshotFile
    .getDescendantsOfKind(SyntaxKind.StringLiteral)
    .map((literal) => literal.getLiteralText()));
  if (!screenshotLiterals.has("screenshot_target") || !screenshotValues.has("BrowserCommandRuntime")) {
    missing.push("snapshot-deadline-screenshot:exact-target-capture");
  }
  if (screenshotValues.has("activateChrome")) {
    missing.push("snapshot-deadline-screenshot:no-foreground-activation");
  }
  if (!hasConstInitializer(files.stepsFile, "UPLOAD_DIALOG_READY_TIMEOUT_MS", 2_000)) {
    missing.push("upload-dialog-timeout-2000");
  }
  if (!hasConstInitializer(files.fileAttachmentFile, "FILE_INPUT_READY_TIMEOUT_MS", 2_000)) {
    missing.push("file-input-timeout-2000");
  }
  if (!hasConstInitializer(files.verifyFile, "UPLOAD_SUCCESS_OBSERVATION_LIMIT", 40)) {
    missing.push("upload-success-observation-limit-40");
  }
  if (files.flowFile.getFunction("openSellerCentralEntry") || files.flowFile.getFunction("waitForSellerCentralEntry")) {
    missing.push("single-order-navigation:retired-entry-open-wait");
  }
  if (files.flowFile.getVariableDeclaration("ENTRY_READY_TIMEOUT_MS")) {
    missing.push("single-order-navigation:retired-entry-timeout");
  }
  return missing;
}
