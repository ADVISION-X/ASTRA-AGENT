import { createHash, randomUUID } from "node:crypto";

import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { BrowserOpenReusePolicy } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { gatedResult, readSnapshot, taskResult } from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadExecutionContext, AmazonInvoiceUploadTaskResult, AmazonOrderNavigationProof } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import {
  emitAmazonOrderDetailNavigationStarted,
  emitAmazonOrderDetailNavigationTerminal,
  recordAmazonDomStepTrace,
  startAmazonDomStepTrace,
} from "./amazon-dom-step-trace.js";

type DomSnapshot = Awaited<ReturnType<typeof readSnapshot>>;

const ORDER_DETAIL_READY_TIMEOUT_MS = 2_000;
const ORDER_DETAIL_READY_POLL_INTERVAL_MS = 200;
const ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT = 8;

type OrderDetailWaitResult =
  | { status: "ready" }
  | { status: "blocked"; result: AmazonInvoiceUploadTaskResult }
  | { status: "not_ready"; reason: string };

type NavigationOutcomeInput = {
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  execution: AmazonInvoiceUploadExecutionContext;
  reusePolicy: BrowserOpenReusePolicy;
  browserActionId: string;
  beforeHash: string;
  actionResult: "success" | "failed";
  navigationMode: string;
  observedUrlMatchesRequest: boolean;
  afterHash: string;
  startedAt: string;
  durationMs: number;
  reason: string;
};

export async function openApprovedOrderDetail(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  execution: AmazonInvoiceUploadExecutionContext,
): Promise<{ ok: true; proof: AmazonOrderNavigationProof } | { ok: false; failure: AmazonInvoiceUploadTaskResult }> {
  const detailUrl = buildApprovedOrderDetailUrl(mission);
  const reusePolicy = await orderDetailReusePolicy(browser, detailUrl);
  const browserActionId = `browser:${randomUUID()}`;
  const beforeHash = stateHash(browser.getSessionState().currentUrl);
  const proofResult = await openAndPersistOrderDetailNavigation({
    browser,
    runtimeLogger,
    mission,
    execution,
    detailUrl,
    reusePolicy,
    browserActionId,
    beforeHash,
  });
  if (!proofResult.ok) return proofResult;
  const proof = proofResult.proof;
  let lastReason = "Order detail page did not show the requested order id and invoice action state.";
  for (let window = 1; window <= ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT; window += 1) {
    const readiness = await waitForApprovedOrderDetail(browser, runtimeLogger, mission, execution, window);
    if (readiness.status === "ready") return { ok: true, proof };
    if (readiness.status === "blocked") return { ok: false, failure: withNavigationProof(readiness.result, proof, execution.runtimeLogRef) };
    lastReason = readiness.reason;
    if (window < ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT) {
      recordAmazonDomStepTrace({
        runtimeLogger,
        mission,
        stepName: `continue same-page order readiness window ${window + 1}`,
        status: "snapshot",
        reason: `The preceding 2000ms observation failed. Continue on the same page without refresh or another navigation.`,
      });
    }
  }
  return { ok: false, failure: withNavigationProof(buildOrderDetailNotFoundResult(mission, lastReason), proof, execution.runtimeLogRef) };
}

async function openAndPersistOrderDetailNavigation(input: {
  browser: BrowserController;
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  execution: AmazonInvoiceUploadExecutionContext;
  detailUrl: string;
  reusePolicy: BrowserOpenReusePolicy;
  browserActionId: string;
  beforeHash: string;
}): Promise<{ ok: true; proof: AmazonOrderNavigationProof } | { ok: false; failure: AmazonInvoiceUploadTaskResult }> {
  const fallbackStartedAt = new Date().toISOString();
  const fallbackStartedAtMs = Date.now();
  emitAmazonOrderDetailNavigationStarted({
    runtimeLogger: input.runtimeLogger,
    executionId: input.execution.executionId,
    browserActionId: input.browserActionId,
    beforeHash: input.beforeHash,
    runtimeLogRef: input.execution.runtimeLogRef,
    amazonOrderId: input.mission.amazonOrderId,
    ...(input.execution.taskId ? { taskId: input.execution.taskId } : {}),
  });
  let openResult: Awaited<ReturnType<BrowserController["open"]>>;
  try {
    openResult = await input.browser.open({
      url: input.detailUrl,
      title: "Amazon Seller Central approved order detail",
      reusePolicy: input.reusePolicy,
      browserActionId: input.browserActionId,
      abortSignal: input.execution.abortSignal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return persistAndEmitNavigationOutcome({
      ...input,
      actionResult: "failed",
      navigationMode: "unknown",
      observedUrlMatchesRequest: false,
      afterHash: stateHash(input.browser.getSessionState().currentUrl),
      startedAt: fallbackStartedAt,
      durationMs: Math.max(0, Date.now() - fallbackStartedAtMs),
      reason,
    });
  }
  const structuredOpenResult = hasStructuredNavigationReceipt(openResult);
  const actionResult = openResult.ok && structuredOpenResult && openResult.observedUrlMatchesRequest ? "success" : "failed";
  const outcomeInput = {
    ...input,
    actionResult,
    navigationMode: openResult.navigationMode ?? "unknown",
    observedUrlMatchesRequest: openResult.observedUrlMatchesRequest === true,
    afterHash: stateHash(openResult.observedUrl ?? input.browser.getSessionState().currentUrl),
    startedAt: openResult.startedAt ?? fallbackStartedAt,
    durationMs: openResult.durationMs ?? Math.max(0, Date.now() - fallbackStartedAtMs),
    reason: structuredOpenResult ? openResult.message : "BrowserController.open did not return the required structured navigation receipt.",
  } as const;
  return persistAndEmitNavigationOutcome(outcomeInput);
}

function hasStructuredNavigationReceipt(
  result: Awaited<ReturnType<BrowserController["open"]>>,
): boolean {
  return result.actionKind === "open"
    && result.startedAt !== undefined
    && result.durationMs !== undefined
    && result.navigationMode !== undefined
    && result.observedUrl !== undefined
    && result.observedUrlMatchesRequest !== undefined;
}

async function persistAndEmitNavigationOutcome(
  input: NavigationOutcomeInput,
): Promise<{ ok: true; proof: AmazonOrderNavigationProof } | { ok: false; failure: AmazonInvoiceUploadTaskResult }> {
  const outcome = await persistNavigationOutcome(input);
  emitAmazonOrderDetailNavigationTerminal({
    runtimeLogger: input.runtimeLogger,
    executionId: input.execution.executionId,
    browserActionId: input.browserActionId,
    runtimeLogRef: input.execution.runtimeLogRef,
    ...(input.execution.taskId ? { taskId: input.execution.taskId } : {}),
    ...(outcome.ok ? { evidenceRef: outcome.proof.evidenceRef } : {}),
    actionResult: input.actionResult,
    beforeHash: input.beforeHash,
    afterHash: input.afterHash,
    durationMs: input.durationMs,
    navigationMode: input.navigationMode,
    observedUrlMatchesRequest: input.observedUrlMatchesRequest,
    reason: input.reason,
  });
  return outcome;
}

async function persistNavigationOutcome(
  input: NavigationOutcomeInput,
): Promise<{ ok: true; proof: AmazonOrderNavigationProof } | { ok: false; failure: AmazonInvoiceUploadTaskResult }> {
  const persisted = await input.execution.evidenceStore.appendRecord({
    missionId: input.execution.executionId,
    runId: input.execution.executionId,
    stepId: "amazon-invoice-order-detail-navigation",
    correlationId: input.browserActionId,
    sourceCapabilityId: "browser-session",
    sourceChildCapabilityId: "open",
    recordType: input.actionResult === "success" ? "evidence" : "failure",
    recordPayload: {
      schemaVersion: "amazonOrderNavigationProof.v1",
      executionId: input.execution.executionId,
      ...(input.execution.taskId ? { taskId: input.execution.taskId } : {}),
      browserActionId: input.browserActionId,
      actionResult: input.actionResult,
      requestedHost: hostFromUrl(input.mission.sellerCentralEntryUrl),
      reusePolicy: input.reusePolicy,
      navigationMode: input.navigationMode,
      observedUrlMatchesRequest: input.observedUrlMatchesRequest,
      beforeHash: input.beforeHash,
      afterHash: input.afterHash,
      startedAt: input.startedAt,
      durationMs: input.durationMs,
    },
    idempotencyKey: `${input.execution.executionId}:order-detail-navigation`,
  });
  const evidenceRef = persisted.recordRef;
  const storageRef = persisted.proof?.storageRef;
  const integrityHash = persisted.proof?.integrityHash;
  const evidenceOk = persisted.status === "success" && evidenceRef && storageRef && integrityHash;
  if (!evidenceOk) {
    return navigationPersistenceFailure(input, persisted.failureReason);
  }
  const proof = buildNavigationProof(input, evidenceRef, storageRef, integrityHash);
  if (input.actionResult === "failed") return navigationActionFailure(input, proof);
  return { ok: true, proof };
}

function buildNavigationProof(
  input: NavigationOutcomeInput,
  evidenceRef: string,
  storageRef: string,
  integrityHash: string,
): AmazonOrderNavigationProof {
  return {
    executionId: input.execution.executionId,
    ...(input.execution.taskId ? { taskId: input.execution.taskId } : {}),
    browserActionId: input.browserActionId,
    actionResult: input.actionResult,
    requestedHost: hostFromUrl(input.mission.sellerCentralEntryUrl),
    reusePolicy: input.reusePolicy,
    navigationMode: input.navigationMode,
    observedUrlMatchesRequest: input.observedUrlMatchesRequest,
    beforeHash: input.beforeHash,
    afterHash: input.afterHash,
    startedAt: input.startedAt,
    durationMs: input.durationMs,
    evidenceRef,
    storageRef,
    integrityHash,
  };
}

function navigationPersistenceFailure(
  input: NavigationOutcomeInput,
  failureReason: string | undefined,
): { ok: false; failure: AmazonInvoiceUploadTaskResult } {
  return { ok: false, failure: taskResult({
    status: "failed",
    reason: `Order-detail navigation proof persistence failed: ${failureReason ?? "missing proof ref or integrity hash"}`,
    reachedStep: "persist order detail navigation proof",
    amazonOrderId: input.mission.amazonOrderId,
    invoiceNo: input.mission.invoiceNo,
    reviewRequired: true,
  }) };
}

function navigationActionFailure(
  input: NavigationOutcomeInput,
  proof: AmazonOrderNavigationProof,
): { ok: false; failure: AmazonInvoiceUploadTaskResult } {
  return { ok: false, failure: withNavigationProof(taskResult({
    status: "failed",
    reason: `Order-detail navigation failed closed: ${input.reason}`,
    reachedStep: "open approved order detail",
    amazonOrderId: input.mission.amazonOrderId,
    invoiceNo: input.mission.invoiceNo,
    reviewRequired: true,
  }), proof, input.execution.runtimeLogRef) };
}

function withNavigationProof(
  result: AmazonInvoiceUploadTaskResult,
  proof: AmazonOrderNavigationProof,
  runtimeLogRef: string,
): AmazonInvoiceUploadTaskResult {
  return { ...result, runtimeLogRef, orderNavigationProof: proof };
}

function stateHash(value: string): string {
  return createHash("sha256").update(value || "about:blank").digest("hex");
}

function hostFromUrl(value: string): string {
  try {
    return new URL(value).host || "local-file";
  } catch {
    return "unknown";
  }
}

async function orderDetailReusePolicy(browser: BrowserController, targetUrl: string): Promise<BrowserOpenReusePolicy> {
  await refreshCurrentBrowserState(browser);
  if (isHttpSellerCentralUrl(targetUrl)) return "reuse-host-tab";
  return isSameOrderWorkerHost(browser.getSessionState().currentUrl, targetUrl) ? "reuse-active-tab" : "open-new-tab";
}

async function refreshCurrentBrowserState(browser: BrowserController): Promise<void> {
  await browser.getGeometrySnapshot().catch(() => null);
}

function isHttpSellerCentralUrl(targetUrl: string): boolean {
  try {
    const url = new URL(targetUrl);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes("sellercentral.amazon.");
  } catch {
    return false;
  }
}

function isSameOrderWorkerHost(currentUrl: string, targetUrl: string): boolean {
  try {
    const current = new URL(currentUrl);
    const target = new URL(targetUrl);
    return current.protocol === target.protocol && current.host === target.host;
  } catch {
    return false;
  }
}

export function buildApprovedOrderDetailUrl(mission: AmazonInvoiceUploadMissionInput): string {
  const url = new URL(mission.sellerCentralEntryUrl);
  if (url.protocol === "file:") return mission.sellerCentralEntryUrl;
  url.pathname = `/orders-v3/order/${encodeURIComponent(mission.amazonOrderId)}`;
  url.search = "";
  return url.toString();
}

const snapshotContainsApprovedOrder = (snapshot: DomSnapshot, amazonOrderId: string): boolean =>
  [
    ...snapshot.tableRows.map((item) => item.visibleText),
    ...snapshot.roleRows.map((item) => item.visibleText),
    ...snapshot.textBlocks.map((item) => item.visibleText),
    ...snapshot.links.map((item) => item.visibleText),
    ...snapshot.buttons.map((item) => item.visibleText),
  ].some((value) => String(value ?? "").includes(amazonOrderId));

const snapshotHasInvoiceActionState = (snapshot: DomSnapshot): boolean =>
  [
    ...snapshot.buttons.map((item) => item.visibleText),
    ...snapshot.links.map((item) => item.visibleText),
    ...snapshot.genericClickableElements.map((item) => item.visibleText),
    ...snapshot.textBlocks.map((item) => item.visibleText),
  ].some((value) => {
    const text = String(value ?? "").toLowerCase();
    return text.includes("上传发票")
      || text.includes("upload invoice")
      || text.includes("管理发票")
      || text.includes("manage invoice")
      || text.includes("感谢您上传文件")
      || text.includes("invoice uploaded successfully");
  });

const snapshotIsLoading = (snapshot: DomSnapshot): boolean =>
  [...snapshot.textBlocks.map((item) => item.visibleText), ...snapshot.dialogs.map((item) => item.visibleText)]
    .some((value) => String(value ?? "").includes("正在加载"));

const waitForApprovedOrderDetail = async (
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  execution: AmazonInvoiceUploadExecutionContext,
  observationWindow: number,
): Promise<OrderDetailWaitResult> => {
  const stepName = `observe approved order detail readiness window ${observationWindow}`;
  const traceStartedAtMs = startAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName,
    traceId: execution.executionId,
    ...(execution.taskId ? { taskId: execution.taskId } : {}),
    runtimeLogRef: execution.runtimeLogRef,
  });
  const startedAt = Date.now();
  const windowDeadlineMs = startedAt + ORDER_DETAIL_READY_TIMEOUT_MS;
  let lastReason = "Order detail page did not show the requested order id and invoice action state.";
  while (Date.now() < windowDeadlineMs) {
    let snapshot: DomSnapshot;
    try {
      snapshot = await readSnapshot(browser, {
        timeoutMs: Math.max(1, windowDeadlineMs - Date.now()),
      }, execution.abortSignal);
    } catch (error) {
      lastReason = `Order detail DOM observation failed within the 2-second window: ${error instanceof Error ? error.message : String(error)}`;
      break;
    }
    const gate = gatedResult(snapshot, mission, stepName);
    if (gate) {
      recordAmazonDomStepTrace({ runtimeLogger, mission, stepName, status: "review_required", snapshot, reason: gate.reason, startedAtMs: traceStartedAtMs, startedAlready: true, traceId: execution.executionId, ...(execution.taskId ? { taskId: execution.taskId } : {}), runtimeLogRef: execution.runtimeLogRef });
      return { status: "blocked", result: gate };
    }
    if (
      snapshotContainsApprovedOrder(snapshot, mission.amazonOrderId)
      && snapshotHasInvoiceActionState(snapshot)
      && !snapshotIsLoading(snapshot)
    ) {
      recordAmazonDomStepTrace({
        runtimeLogger,
        mission,
        stepName,
        status: "success",
        snapshot,
        reason: "Order detail showed the requested order id and invoice action state.",
        startedAtMs: traceStartedAtMs,
        startedAlready: true,
        traceId: execution.executionId,
        ...(execution.taskId ? { taskId: execution.taskId } : {}),
        runtimeLogRef: execution.runtimeLogRef,
      });
      return { status: "ready" };
    }
    lastReason = orderDetailReadinessFailureReason(snapshot, mission.amazonOrderId);
    const remainingWindowMs = windowDeadlineMs - Date.now();
    if (remainingWindowMs > 0) {
      await browser.wait(Math.min(ORDER_DETAIL_READY_POLL_INTERVAL_MS, remainingWindowMs), execution.abortSignal);
    }
  }
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName,
    status: "failed",
    reason: `${lastReason} The 2000ms observation window ${observationWindow}/${ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT} expired.`,
    startedAtMs: traceStartedAtMs,
    startedAlready: true,
    traceId: execution.executionId,
    ...(execution.taskId ? { taskId: execution.taskId } : {}),
    runtimeLogRef: execution.runtimeLogRef,
  });
  return { status: "not_ready", reason: lastReason };
};

const orderDetailReadinessFailureReason = (snapshot: DomSnapshot, amazonOrderId: string): string => {
  if (!snapshotContainsApprovedOrder(snapshot, amazonOrderId)) {
    return "Order detail page did not expose the requested Amazon order id before the readiness window expired.";
  }
  if (!snapshotHasInvoiceActionState(snapshot)) {
    return "Order detail page did not expose upload/manage/already-uploaded invoice action state before the readiness window expired.";
  }
  if (snapshotIsLoading(snapshot)) {
    return "Order detail page still showed loading state before the readiness window expired.";
  }
  return "Order detail page did not show the requested order id and invoice action state.";
};

const buildOrderDetailNotFoundResult = (
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
): AmazonInvoiceUploadTaskResult =>
  taskResult({
    status: "order_not_found",
    reason: `${reason} All ${ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT} same-page observation windows expired; no order-page refresh or repeat navigation was executed.`,
    reachedStep: "open approved order detail",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  });
