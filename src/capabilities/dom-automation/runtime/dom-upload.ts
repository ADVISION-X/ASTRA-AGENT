import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
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
import { assertDomTargetBinding } from "./dom-target-binding.js";

function validateApprovedUploadRequest(
  input: UploadApprovedFileInput,
): DomActionResult | undefined {
  if (input.elementRef.targetKind !== "file-input") {
    return buildDomReviewRequiredResult(
      "upload target is not a located file input",
      "Real upload is limited to located input[type=file].",
    );
  }
  return undefined;
}

function buildDomUploadOutcome(
  uploadResult: Awaited<ReturnType<BrowserTargetLease["setFileInputArtifact"]>>,
  beforeEvidenceRef: string,
  afterEvidenceRef: string,
): DomActionResult {
  return buildDomActionOutcome(
    {
      status: uploadResult.ok ? "success" : "failed",
      message: uploadResult.ok
        ? "approved file selection dispatched once to one real file input receiver"
        : uploadResult.message,
    },
    beforeEvidenceRef,
    afterEvidenceRef,
  );
}

export async function uploadApprovedFileOnce(
  browser: BrowserTargetLease,
  rawInput: UploadApprovedFileInput,
): Promise<DomActionResult> {
  const input = DOM_SCHEMAS.UploadApprovedFileInput.parse(
    rawInput,
  ) as UploadApprovedFileInput;
  assertDomTargetBinding(browser, input.elementRef);
  const validated = validateApprovedUploadRequest(input);
  if (validated) {
    return validated;
  }

  const beforeEvidenceRef = await captureDomEvidenceRef(
    browser,
    "dom-upload-before",
  );
  if (!beforeEvidenceRef) {
    return buildDomReviewRequiredResult(
      "before-upload evidence capture failed",
      "DOM upload requires evidence before setting a file.",
    );
  }
  const uploadResult = await browser.setFileInputArtifact({
    elementRef: {
      selector: input.elementRef.selector,
      targetKind: "file-input",
    },
    grant: input.fileArtifactGrant,
    description: "set approved file on located file input",
  });
  const afterEvidenceRef = await captureDomEvidenceRef(
    browser,
    "dom-upload-after",
  );
  if (!afterEvidenceRef) {
    return buildDomActionResult({
      ok: false,
      status: "failed",
      message: "after-upload evidence capture failed",
      beforeEvidenceRef,
    });
  }

  return buildDomUploadOutcome(
    uploadResult,
    beforeEvidenceRef,
    afterEvidenceRef,
  );
}
