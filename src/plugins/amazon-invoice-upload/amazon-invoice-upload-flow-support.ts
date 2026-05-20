import {
  clickDomElementOnce,
  locateDomElementOnce,
  verifyDomStateOnce,
} from "../../capabilities/dom-automation/index.js";
import type { DomElementRef, DomSnapshot } from "../../capabilities/dom-automation/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import type { AmazonInvoiceUploadStatus } from "./amazon-result-detector.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";

export function evidenceField(evidenceRef: string | undefined): { evidenceRef: string } | Record<string, never> {
  return evidenceRef ? { evidenceRef } : {};
}

export function taskResult(input: Omit<AmazonInvoiceUploadTaskResult, "ok"> & {
  ok?: boolean;
}): AmazonInvoiceUploadTaskResult {
  return {
    ok: input.ok ?? input.status === "upload_success",
    status: input.status,
    reason: input.reason,
    reachedStep: input.reachedStep,
    amazonOrderId: input.amazonOrderId,
    invoiceNo: input.invoiceNo,
    ...(input.evidenceRef ? { evidenceRef: input.evidenceRef } : {}),
    ...(input.reviewRequired ? { reviewRequired: true } : {}),
  };
}

export function gatedResult(
  snapshot: DomSnapshot,
  mission: AmazonInvoiceUploadMissionInput,
  reachedStep: string,
): AmazonInvoiceUploadTaskResult | null {
  const gate = verifyDomStateOnce({
    snapshot,
    expectedStates: ["login-required", "captcha-or-2fa-required"],
    successHints: [],
    failureHints: [],
  });
  if (gate.status !== "login_required" && gate.status !== "captcha_or_2fa_required") {
    return null;
  }
  return taskResult({
    status: gate.status,
    reason: gate.reason,
    reachedStep,
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    evidenceRef: gate.evidenceRef,
    reviewRequired: true,
  });
}

export function locateOrStatus(input: {
  snapshot: DomSnapshot;
  targetKind: Parameters<typeof locateDomElementOnce>[0]["targetKind"];
  hints: string[];
  requiredText?: string;
  notFoundStatus: AmazonInvoiceUploadStatus;
}): { ok: true; element: DomElementRef } | { ok: false; status: AmazonInvoiceUploadStatus; reason: string } {
  try {
    return {
      ok: true,
      element: locateDomElementOnce({
        snapshot: input.snapshot,
        targetKind: input.targetKind,
        hints: input.hints,
        ...(input.requiredText ? { requiredText: input.requiredText } : {}),
      }),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: reason.toLowerCase().includes("ambiguous") ? "ambiguous" : input.notFoundStatus,
      reason,
    };
  }
}

export async function clickLocated(input: {
  browser: BrowserController;
  element: DomElementRef;
  expectedKind: string;
  reachedStep: string;
  mission: AmazonInvoiceUploadMissionInput;
  expectedText?: string;
}): Promise<AmazonInvoiceUploadTaskResult | null> {
  const clicked = await clickDomElementOnce(input.browser, {
    elementRef: input.element,
    expectedKind: input.expectedKind,
    waitAfterMs: 800,
    ...(input.expectedText ? { expectedText: input.expectedText } : {}),
  });
  if (clicked.ok) {
    return null;
  }
  return taskResult({
    status: clicked.status === "ambiguous" ? "ambiguous" : "failed",
    reason: clicked.reviewRequiredReason ?? clicked.message,
    reachedStep: input.reachedStep,
    amazonOrderId: input.mission.amazonOrderId,
    invoiceNo: input.mission.invoiceNo,
    ...evidenceField(clicked.afterEvidenceRef ?? clicked.beforeEvidenceRef),
    reviewRequired: clicked.status === "review_required",
  });
}

export function locateFailureResult(
  mission: AmazonInvoiceUploadMissionInput,
  located: { ok: false; status: AmazonInvoiceUploadStatus; reason: string },
  reachedStep: string,
): AmazonInvoiceUploadTaskResult {
  return taskResult({
    status: located.status,
    reason: located.reason,
    reachedStep,
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  });
}
