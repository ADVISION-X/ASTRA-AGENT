import {
  clickDomElementOnce,
  fillDomElementOnce,
  locateDomElementOnce,
  readDomSnapshotOnce,
  uploadApprovedFileOnce,
  verifyDomStateOnce,
  waitForDomStateOnce,
} from "../../capabilities/dom-automation/index.js";
import type { DomElementRef, DomSnapshot } from "../../types/dom-automation.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import type { AmazonInvoiceUploadStatus } from "./amazon-result-detector.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import { amazonDomTraceRefFromIds, recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";

const DOM_CLICK_SETTLE_MS = 50;

export const readSnapshot = (browser: BrowserController) => readDomSnapshotOnce(browser);

export const fillElement = (
  browser: BrowserController,
  input: Parameters<typeof fillDomElementOnce>[1],
) => fillDomElementOnce(browser, input);

export const uploadFile = (
  browser: BrowserController,
  input: Parameters<typeof uploadApprovedFileOnce>[1],
) => uploadApprovedFileOnce(browser, input);

export const waitForState = (
  browser: BrowserController,
  input: Parameters<typeof waitForDomStateOnce>[1],
) => waitForDomStateOnce(browser, input);

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
    domTraceRef: amazonDomTraceRefFromIds({
      amazonOrderId: input.amazonOrderId,
      invoiceNo: input.invoiceNo,
    }),
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
  targetKind: DomElementRef["targetKind"];
  hints: string[];
  requiredText?: string;
  notFoundStatus: AmazonInvoiceUploadStatus;
}): { ok: true; element: DomElementRef } | { ok: false; status: AmazonInvoiceUploadStatus; reason: string } {
  const element = locateDomElementOnce({
    snapshot: input.snapshot,
    targetKind: input.targetKind,
    hints: input.hints,
    ...(input.requiredText ? { requiredText: input.requiredText } : {}),
  });
  if (element.elementRef.startsWith("dom:unresolved:")) {
    const status = element.elementRef.endsWith(":ambiguous") ? "ambiguous" : input.notFoundStatus;
    return { ok: false, status, reason: element.reason };
  }
  return { ok: true, element };
}

export async function clickLocated(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  element: DomElementRef;
  expectedKind: string;
  reachedStep: string;
  mission: AmazonInvoiceUploadMissionInput;
  expectedText?: string;
}): Promise<AmazonInvoiceUploadTaskResult | null> {
  const clicked = await clickDomElementOnce(input.browser, {
    elementRef: input.element,
    expectedKind: input.expectedKind,
    waitAfterMs: DOM_CLICK_SETTLE_MS,
    ...(input.expectedText ? { expectedText: input.expectedText } : {}),
  });
  if (clicked.ok) {
    return null;
  }
  recordAmazonDomStepTrace({
    runtimeLogger: input.runtimeLogger,
    mission: input.mission,
    stepName: input.reachedStep,
    status: clicked.status === "review_required" ? "review_required" : "failed",
    selectedElement: input.element,
    reason: clicked.reviewRequiredReason ?? clicked.message,
    evidenceRef: clicked.afterEvidenceRef ?? clicked.beforeEvidenceRef,
  });
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
