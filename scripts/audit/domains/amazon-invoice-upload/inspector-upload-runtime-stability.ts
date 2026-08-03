import { Node, SyntaxKind, type SourceFile } from "ts-morph";

export type UploadRuntimeStabilityFiles = {
  flowFile: SourceFile;
  flowSupportFile: SourceFile;
  orderFile: SourceFile;
  stepsFile: SourceFile;
  fileAttachmentFile: SourceFile;
  verifyFile: SourceFile;
  chromeScreenshotFile: SourceFile;
};

export const hasConstInitializer = (file: SourceFile, name: string, initializerText: string): boolean =>
  file.getVariableDeclaration(name)?.getInitializer()?.getText() === initializerText;

export function collectUploadRuntimeStabilityGaps(files: UploadRuntimeStabilityFiles): string[] {
  const missing: string[] = [];
  if (!hasConstInitializer(files.flowSupportFile, "AMAZON_INVOICE_SNAPSHOT_TIMEOUT_MS", "1_800")) {
    missing.push("snapshot-deadline-flow-support:1800ms");
  }
  if (!(files.flowSupportFile.getVariableDeclaration("readSnapshot")?.getDescendantsOfKind(SyntaxKind.Identifier)
    .some((identifier) => identifier.getText() === "AMAZON_INVOICE_SNAPSHOT_TIMEOUT_MS") ?? false)) {
    missing.push("snapshot-deadline-flow-support:explicit-timeout");
  }
  if (!(files.orderFile.getVariableDeclaration("waitForApprovedOrderDetail")?.getDescendantsOfKind(SyntaxKind.CatchClause).length)) {
    missing.push("snapshot-deadline-order-detail:structured-exception");
  }
  if (!(files.chromeScreenshotFile.getVariableDeclaration("captureCurrentChromeScreenshot")?.getDescendantsOfKind(SyntaxKind.CallExpression)
    .some((call) => Node.isIdentifier(call.getExpression()) && call.getExpression().getText() === "activateChrome") ?? false)) {
    missing.push("snapshot-deadline-screenshot:activate-controlled-window");
  }
  if (!hasConstInitializer(files.stepsFile, "UPLOAD_DIALOG_READY_TIMEOUT_MS", "2_000")) {
    missing.push("upload-dialog-timeout-2000");
  }
  if (!hasConstInitializer(files.fileAttachmentFile, "FILE_INPUT_READY_TIMEOUT_MS", "2_000")) {
    missing.push("file-input-timeout-2000");
  }
  if (!hasConstInitializer(files.verifyFile, "UPLOAD_SUCCESS_TIMEOUT_MS", "2_000")) {
    missing.push("upload-success-timeout-2000");
  }
  if (files.flowFile.getFunction("openSellerCentralEntry") || files.flowFile.getFunction("waitForSellerCentralEntry")) {
    missing.push("single-order-navigation:retired-entry-open-wait");
  }
  if (files.flowFile.getVariableDeclaration("ENTRY_READY_TIMEOUT_MS")) {
    missing.push("single-order-navigation:retired-entry-timeout");
  }
  return missing;
}
