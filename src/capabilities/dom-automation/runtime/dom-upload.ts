import { existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

import { createId } from "../../../lib/local-runtime/ids.js";
import { DomActionResultSchema, UploadApprovedFileInputSchema } from "../schema.js";
import type { DomActionResult, UploadApprovedFileInput } from "../schema.js";

export function uploadApprovedFileOnce(rawInput: UploadApprovedFileInput): DomActionResult {
  const input = UploadApprovedFileInputSchema.parse(rawInput);
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

  return DomActionResultSchema.parse({
    ok: false,
    status: "not_implemented",
    actionId: createId("dom"),
    message: "file upload connector is reserved for phase two",
    reviewRequiredReason: "Phase one validates approved PDF payload only and stops before setting files.",
  });
}
