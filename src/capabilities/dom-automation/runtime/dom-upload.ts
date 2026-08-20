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
  beforeEvidenceRef: string,
  afterEvidenceRef: string,
): DomActionResult {
  return buildDomActionOutcome(
    {
      status: "success",
      message: "approved file selection dispatched once to one real file input receiver",
    },
    beforeEvidenceRef,
    afterEvidenceRef,
  );
}

export async function uploadApprovedFileOnce(
  browser: BrowserTargetLease,
  rawInput: UploadApprovedFileInput,
): Promise<DomActionResult> {
  DOM_SCHEMAS.UploadApprovedFileInput.parse(rawInput);
  const input = rawInput;
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
  await browser.attachFile({ selector: input.elementRef.selector, grants: [input.fileArtifactGrant] });
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
    beforeEvidenceRef,
    afterEvidenceRef,
  );
}
