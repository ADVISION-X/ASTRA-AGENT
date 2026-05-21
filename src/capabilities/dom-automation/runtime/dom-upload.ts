import { existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";

import type { BrowserController } from "../../../lib/browser/browser-controller.js";
import { DOM_SCHEMAS } from "../schema.js";
import type { DomActionResult } from "../../../types/dom-automation.js";
import type { UploadApprovedFileInput } from "../../../types/dom-automation-inputs.js";
import {
  buildDomActionOutcome,
  buildDomFailureResult,
  buildDomActionResult,
  buildDomReviewRequiredResult,
} from "./dom-action-result.js";
import { captureDomEvidenceRef } from "./dom-evidence.js";

function validateApprovedUploadRequest(input: UploadApprovedFileInput): DomActionResult | { approvedPath: string } {
  const approvedPath = resolve(input.approvedFilePath);
  const taskPath = resolve(input.approvedTaskFilePath);
  const extension = extname(approvedPath).toLowerCase();
  if (approvedPath !== taskPath) {
    return buildDomReviewRequiredResult(
      "approved file path does not match task payload",
      "DOM upload refuses arbitrary file paths.",
    );
  }
  if (!existsSync(approvedPath) || !statSync(approvedPath).isFile()) {
    return buildDomFailureResult("approved file does not exist");
  }
  if (!input.allowedExtensions.includes(extension)) {
    return buildDomReviewRequiredResult(
      "approved file extension is not allowed",
      "Approved file upload only allows task-listed extensions.",
    );
  }
  if (input.elementRef.targetKind !== "file-input") {
    return buildDomReviewRequiredResult(
      "upload target is not a located file input",
      "Real upload is limited to located input[type=file].",
    );
  }
  return { approvedPath };
}

function buildDomUploadOutcome(
  uploadResult: Awaited<ReturnType<BrowserController["setFileInputFiles"]>>,
  beforeEvidenceRef: string,
  afterEvidenceRef: string,
): DomActionResult {
  return buildDomActionOutcome(
    {
      status: uploadResult.ok ? "success" : "failed",
      message: uploadResult.ok ? "approved file selected for located file input" : uploadResult.message,
    },
    beforeEvidenceRef,
    afterEvidenceRef,
  );
}

export async function uploadApprovedFileOnce(
  browser: BrowserController,
  rawInput: UploadApprovedFileInput,
): Promise<DomActionResult> {
  const input = DOM_SCHEMAS.UploadApprovedFileInput.parse(rawInput) as UploadApprovedFileInput;
  const validated = validateApprovedUploadRequest(input);
  if ("ok" in validated) {
    return validated;
  }

  const beforeEvidenceRef = await captureDomEvidenceRef(browser, "dom-upload-before");
  if (!beforeEvidenceRef) {
    return buildDomReviewRequiredResult(
      "before-upload evidence capture failed",
      "DOM upload requires evidence before setting a file.",
    );
  }
  const uploadResult = await browser.setFileInputFiles({
    elementRef: {
      selector: input.elementRef.selector,
      targetKind: "file-input",
    },
    filePath: validated.approvedPath,
    description: "set approved file on located file input",
  });
  const afterEvidenceRef = await captureDomEvidenceRef(browser, "dom-upload-after");
  if (!afterEvidenceRef) {
    return buildDomActionResult({
      ok: false,
      status: "failed",
      message: "after-upload evidence capture failed",
      beforeEvidenceRef,
    });
  }

  return buildDomUploadOutcome(uploadResult, beforeEvidenceRef, afterEvidenceRef);
}
