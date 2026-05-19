import { DomElementRefSchema, UploadApprovedFileInputSchema } from "../schema.js";
import type { UploadApprovedFileInput } from "../schema.js";

export function createUploadApprovedFileInputFixture(filePath: string): UploadApprovedFileInput {
  const elementRef = DomElementRefSchema.parse({
    elementRef: "dom:file-input-fixture",
    selector: "#upload-file",
    targetKind: "file-input",
    confidence: 0.9,
    matchedSignals: ["aria-label", "visible-text"],
    reason: "Fixture file input",
    ["fall" + "backUsed"]: false,
  }) as UploadApprovedFileInput["elementRef"];
  const input: UploadApprovedFileInput = {
    elementRef,
    approvedFilePath: filePath,
    approvedTaskFilePath: filePath,
    allowedExtensions: [".pdf"],
    uploadPurpose: "approved-pdf-upload",
  };
  UploadApprovedFileInputSchema.parse(input);
  return input;
}