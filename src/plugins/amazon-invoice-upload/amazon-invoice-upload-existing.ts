import type { DomElementRef } from "../../types/dom-automation.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import {
  clickLocated,
  evidenceField,
  readSnapshot,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import {
  hasExistingInvoiceEvidence,
  locateManageInvoiceEntry,
} from "./amazon-existing-invoice-evidence.js";

const existingInvoiceEvidenceTimeoutMs = 2_000;
const existingInvoiceEvidencePollMs = 250;
const noAvailableActionsDialogDismissTimeoutMs = 2_000;
const noAvailableActionsDialogText = "很抱歉，目前没有可用的操作。";

type ExistingInvoiceEvidenceWaitResult =
  | { kind: "confirmed"; evidenceRef: string }
  | { kind: "no_available_actions"; snapshot: Awaited<ReturnType<typeof readSnapshot>> }
  | { kind: "timeout" };

type OutsideDialogClickResult =
  | { ok: true }
  | { ok: false; reason: string };

type AlreadyUploadedRetainedTabInput = {
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  reason: string;
  evidenceRef: string | undefined;
};

export async function verifyAlreadyUploadedInvoice(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const snapshot = await readSnapshot(browser);
  if (hasExistingInvoiceEvidence(snapshot, mission)) {
    traceAlreadyUploaded(runtimeLogger, mission, snapshot);
    return alreadyUploadedWithRetainedTab({
      runtimeLogger,
      mission,
      reason: "order detail already showed uploaded invoice state",
      evidenceRef: undefined,
    });
  }

  const manageEntry = await openManageInvoiceList(browser, runtimeLogger, mission, snapshot);
  if (manageEntry !== null) return manageEntry === "not-found" ? null : manageEntry;

  const firstWait = await waitForExistingInvoiceEvidence(browser, runtimeLogger, mission);
  if (firstWait.kind === "confirmed") {
    return alreadyUploadedWithRetainedTab({
      runtimeLogger,
      mission,
      reason: "existing invoice verified from Amazon invoice list",
      evidenceRef: firstWait.evidenceRef,
    });
  }
  if (firstWait.kind === "timeout") {
    return existingInvoiceNeedsReview(
      mission,
      `Amazon exposes a manage-invoice entry, but the invoice list did not confirm the expected invoice within ${existingInvoiceEvidenceTimeoutMs}ms.`,
    );
  }

  const dismissFailure = await dismissNoAvailableActionsDialog(
    browser,
    runtimeLogger,
    mission,
    firstWait.snapshot,
  );
  if (dismissFailure) return dismissFailure;

  const reopenedSnapshot = await readSnapshot(browser);
  const reopenedManageEntry = await openManageInvoiceList(browser, runtimeLogger, mission, reopenedSnapshot);
  if (reopenedManageEntry !== null) {
    return existingInvoiceNeedsReview(
      mission,
      "Amazon manage-invoice recovery dismissed the blocked dialog, but Manage invoice could not be reopened safely.",
    );
  }

  const secondWait = await waitForExistingInvoiceEvidence(browser, runtimeLogger, mission);
  if (secondWait.kind === "confirmed") {
    return alreadyUploadedWithRetainedTab({
      runtimeLogger,
      mission,
      reason: "existing invoice verified after one governed no-actions dialog dismissal and reopen",
      evidenceRef: secondWait.evidenceRef,
    });
  }

  return existingInvoiceNeedsReview(
    mission,
    secondWait.kind === "no_available_actions"
      ? "Amazon returned the same no-available-actions dialog after the single governed dismissal and reopen recovery."
      : `Amazon did not confirm the expected invoice within ${existingInvoiceEvidenceTimeoutMs}ms after the single governed dismissal and reopen recovery.`,
  );
}

function traceAlreadyUploaded(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "verify already uploaded invoice",
    status: "success",
    snapshot,
    reason: "Order detail already exposed uploaded invoice evidence.",
  });
}

async function openManageInvoiceList(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): Promise<AmazonInvoiceUploadTaskResult | "not-found" | null> {
  const manageEntry = locateManageInvoiceEntry(snapshot);
  if (!manageEntry.ok) return "not-found";
  traceManageInvoiceEntry(runtimeLogger, mission, snapshot, manageEntry.element);
  const clickFailure = await clickLocated({
    browser,
    runtimeLogger,
    element: manageEntry.element,
    expectedKind: "manage-invoice-entry",
    reachedStep: "open existing invoice list",
    mission,
  });
  if (clickFailure) return clickFailure;
  traceManageInvoiceClick(runtimeLogger, mission, manageEntry.element);
  return null;
}

function traceManageInvoiceEntry(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  element: DomElementRef,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "locate manage invoice entry",
    status: "success",
    snapshot,
    selectedElement: element,
    reason: element.reason,
  });
}

function traceManageInvoiceClick(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  element: DomElementRef,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "click manage invoice entry",
    status: "success",
    selectedElement: element,
  });
}

async function dismissNoAvailableActionsDialog(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "detect no available invoice actions dialog",
    status: "snapshot",
    snapshot,
    reason: "The unique current-order invoice dialog exposed the exact no-available-actions blocker.",
  });

  const clicked = await clickSafeOutsideDialogPoint(browser, mission);
  if (!clicked.ok) {
    return existingInvoiceNeedsReview(
      mission,
      `Amazon manage-invoice recovery could not click the verified outside-dialog blank area: ${clicked.reason}`,
    );
  }
  if (!await waitForNoAvailableActionsDialogDismissal(browser, mission)) {
    return existingInvoiceNeedsReview(
      mission,
      "Amazon manage-invoice recovery clicked outside the dialog, but the blocked dialog did not disappear.",
    );
  }
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "dismiss no available invoice actions dialog",
    status: "success",
    reason: "Clicked one live DOM-derived blank point outside the dialog and verified that the blocked dialog disappeared.",
  });
  return null;
}

async function clickSafeOutsideDialogPoint(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<OutsideDialogClickResult> {
  const orderId = JSON.stringify(mission.amazonOrderId);
  const blockerText = JSON.stringify(noAvailableActionsDialogText);
  return browser.evaluateActiveTab<OutsideDialogClickResult>({
    description: "locate and click one safe blank point outside the blocked Amazon manage-invoice dialog",
    script: `
      const orderId = ${orderId};
      const blockerText = ${blockerText};
      const dialogs = Array.from(document.querySelectorAll("dialog,[role=dialog],[aria-modal=true]"))
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          const text = element.textContent || "";
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none"
            && text.includes(orderId) && text.includes(blockerText);
        });
      if (dialogs.length !== 1) {
        return { ok: false, reason: "Amazon manage-invoice recovery requires exactly one visible current-order no-actions dialog." };
      }
      const rect = dialogs[0].getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const candidates = [
        { area: Math.max(0, rect.left) * viewportHeight, x: rect.left / 2, y: viewportHeight / 2 },
        { area: Math.max(0, viewportWidth - rect.right) * viewportHeight, x: (rect.right + viewportWidth) / 2, y: viewportHeight / 2 },
        { area: Math.max(0, rect.top) * viewportWidth, x: viewportWidth / 2, y: rect.top / 2 },
        { area: Math.max(0, viewportHeight - rect.bottom) * viewportWidth, x: viewportWidth / 2, y: (rect.bottom + viewportHeight) / 2 },
      ].filter((candidate) => candidate.area > 0)
        .sort((left, right) => right.area - left.area);
      const point = candidates.find((candidate) => {
        const target = document.elementFromPoint(candidate.x, candidate.y);
        return target && !dialogs[0].contains(target)
          && !target.closest("a,button,input,select,textarea,[role=button],[role=link],[contenteditable=true]");
      });
      if (!point || point.x < 1 || point.y < 1 || point.x >= viewportWidth || point.y >= viewportHeight
        || (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom)) {
        return { ok: false, reason: "Amazon manage-invoice recovery could not derive a safe blank point outside the live dialog." };
      }
      const target = document.elementFromPoint(point.x, point.y);
      if (!(target instanceof HTMLElement)) {
        return { ok: false, reason: "Amazon manage-invoice recovery blank point has no clickable DOM target." };
      }
      target.click();
      return { ok: true };
    `,
  });
}

async function waitForNoAvailableActionsDialogDismissal(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < noAvailableActionsDialogDismissTimeoutMs) {
    const snapshot = await readSnapshot(browser);
    if (!hasNoAvailableActionsDialog(snapshot, mission)) return true;
    await browser.wait(existingInvoiceEvidencePollMs);
  }
  return false;
}

function hasNoAvailableActionsDialog(
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
  mission: AmazonInvoiceUploadMissionInput,
): boolean {
  return snapshot.dialogs.some((dialog) => {
    const text = dialog.visibleText ?? "";
    return text.includes(mission.amazonOrderId) && text.includes(noAvailableActionsDialogText);
  });
}

function existingInvoiceNeedsReview(
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
): AmazonInvoiceUploadTaskResult {
  return taskResult({
    status: "review_required",
    reason,
    reachedStep: "verify existing invoice",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  });
}

async function waitForExistingInvoiceEvidence(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<ExistingInvoiceEvidenceWaitResult> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < existingInvoiceEvidenceTimeoutMs) {
    const snapshot = await readSnapshot(browser);
    if (hasExistingInvoiceEvidence(snapshot, mission)) {
      const evidenceRef = `amazon-existing-invoice:${mission.amazonOrderId}:${Date.now()}`;
      recordAmazonDomStepTrace({
        runtimeLogger,
        mission,
        stepName: "verify existing invoice",
        status: "success",
        snapshot,
        evidenceRef,
        reason: "Amazon invoice list confirmed the expected invoice.",
      });
      return { kind: "confirmed", evidenceRef };
    }
    if (hasNoAvailableActionsDialog(snapshot, mission)) {
      return { kind: "no_available_actions", snapshot };
    }
    await browser.wait(existingInvoiceEvidencePollMs);
  }
  return { kind: "timeout" };
}

function alreadyUploadedWithRetainedTab(input: AlreadyUploadedRetainedTabInput): AmazonInvoiceUploadTaskResult {
  traceAlreadyUploadedRetainedTab(input.runtimeLogger, input.mission, input.evidenceRef);
  return alreadyUploadedSuccess(input.mission, input.reason, input.evidenceRef);
}

function traceAlreadyUploadedRetainedTab(
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  evidenceRef: string | undefined,
): void {
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "retain already uploaded order tab",
    status: "success",
    reason: "Active Seller Central order worker tab retained after already-uploaded verification.",
    evidenceRef,
  });
}

function alreadyUploadedSuccess(
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
  evidenceRef: string | undefined,
): AmazonInvoiceUploadTaskResult {
  return taskResult({
    status: "already_uploaded",
    reason: `Amazon Seller Central shows this invoice is already uploaded; ${reason}; active order tab retained for next invoice navigation.`,
    reachedStep: "already uploaded verified",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    ...evidenceField(evidenceRef),
  });
}
