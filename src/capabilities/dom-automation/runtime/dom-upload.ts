import { existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { createId } from "../../../lib/local-runtime/ids.js";
import { DomActionResultSchema, UploadApprovedFileInputSchema } from "../schema.js";
import type { DomActionResult, UploadApprovedFileInput } from "../schema.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";

export async function uploadApprovedFileOnce(
  browser: BrowserController,
  rawInput: UploadApprovedFileInput,
): Promise<DomActionResult> {
  const input = UploadApprovedFileInputSchema.parse(rawInput) as UploadApprovedFileInput;
  const approvedPath = resolve(input.approvedFilePath);
  const taskPath = resolve(input.approvedTaskFilePath);
  const extension = extname(approvedPath).toLowerCase();

  if (approvedPath !== taskPath) {
    return DomActionResultSchema.parse({
      ok: false,
      status: "review_required",
      actionId: createId("dom"),
      message: "approved file path does not match task payload",
      reviewRequiredReason: "DOM upload refuses arbitrary file paths.",
    });
  }
  if (!existsSync(approvedPath) || !statSync(approvedPath).isFile()) {
    return DomActionResultSchema.parse({
      ok: false,
      status: "failed",
      actionId: createId("dom"),
      message: "approved file does not exist",
    });
  }
  if (!input.allowedExtensions.includes(extension as ".pdf")) {
    return DomActionResultSchema.parse({
      ok: false,
      status: "review_required",
      actionId: createId("dom"),
      message: "approved file extension is not allowed",
      reviewRequiredReason: "Phase one approved file upload only allows PDF.",
    });
  }
  if (input.elementRef.targetKind !== "file-input") {
    return DomActionResultSchema.parse({
      ok: false,
      status: "review_required",
      actionId: createId("dom"),
      message: "upload target is not a located file input",
      reviewRequiredReason: "Real upload is limited to located input[type=file].",
    });
  }

  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-upload-before");
  if (!beforeEvidenceRef) {
    return DomActionResultSchema.parse({
      ok: false,
      status: "review_required",
      actionId: createId("dom"),
      message: "before-upload evidence capture failed",
      reviewRequiredReason: "DOM upload requires evidence before setting a file.",
    });
  }
  const uploadResult = await browser.setFileInputFiles({
    elementRef: {
      selector: input.elementRef.selector,
      targetKind: "file-input",
    },
    filePath: approvedPath,
    description: "set approved invoice PDF on located file input",
  });
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-upload-after");
  if (!afterEvidenceRef) {
    return DomActionResultSchema.parse({
      ok: false,
      status: "failed",
      actionId: createId("dom"),
      message: "after-upload evidence capture failed",
      beforeEvidenceRef,
    });
  }

  return DomActionResultSchema.parse({
    ok: uploadResult.ok,
    status: uploadResult.ok ? "success" : "failed",
    actionId: createId("dom"),
    message: uploadResult.ok ? "approved PDF selected for located file input" : uploadResult.message,
    beforeEvidenceRef,
    afterEvidenceRef,
    ...(uploadResult.ok ? {} : { reviewRequiredReason: uploadResult.message }),
  });
}
