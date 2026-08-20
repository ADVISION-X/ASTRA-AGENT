import type { BrowserTargetLease } from "../../lib/browser/browser-authority-api.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import {
  gatedResult,
  readSnapshot,
  taskResult,
} from "./amazon-invoice-upload-flow-support.js";
import type {
  AmazonInvoiceUploadExecutionContext,
  AmazonInvoiceUploadTaskResult,
} from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import {
  recordAmazonDomStepTrace,
  startAmazonDomStepTrace,
} from "./amazon-dom-step-trace.js";

type DomSnapshot = Awaited<ReturnType<typeof readSnapshot>>;

export type OrderDetailWaitResult =
  | { status: "ready" }
  | { status: "blocked"; result: AmazonInvoiceUploadTaskResult }
  | { status: "technical_failure"; result: AmazonInvoiceUploadTaskResult }
  | { status: "not_ready"; reason: string };

const ORDER_DETAIL_READY_TIMEOUT_MS = 2_000;
const ORDER_DETAIL_READY_POLL_INTERVAL_MS = 200;
const ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT = 8;

const snapshotContainsApprovedOrder = (
  snapshot: DomSnapshot,
  amazonOrderId: string,
): boolean =>
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
    return (
      text.includes("上传发票") ||
      text.includes("upload invoice") ||
      text.includes("管理发票") ||
      text.includes("manage invoice") ||
      text.includes("感谢您上传文件") ||
      text.includes("invoice uploaded successfully")
    );
  });

const snapshotIsLoading = (snapshot: DomSnapshot): boolean =>
  [
    ...snapshot.textBlocks.map((item) => item.visibleText),
    ...snapshot.dialogs.map((item) => item.visibleText),
  ].some((value) => String(value ?? "").includes("正在加载"));

type OrderDetailObservation =
  | Exclude<OrderDetailWaitResult, { status: "not_ready" }>
  | { status: "pending"; reason: string };

const recordOrderObservation = (input: {
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  execution: AmazonInvoiceUploadExecutionContext;
  stepName: string;
  traceStartedAtMs: number;
  status: "failed" | "review_required" | "success";
  reason: string;
  snapshot?: DomSnapshot;
}): void =>
  recordAmazonDomStepTrace({
    runtimeLogger: input.runtimeLogger,
    mission: input.mission,
    stepName: input.stepName,
    status: input.status,
    reason: input.reason,
    ...(input.snapshot ? { snapshot: input.snapshot } : {}),
    startedAtMs: input.traceStartedAtMs,
    startedAlready: true,
    traceId: input.execution.executionId,
    ...(input.execution.taskId ? { taskId: input.execution.taskId } : {}),
    runtimeLogRef: input.execution.runtimeLogRef,
  });

const observeOrderDetailOnce = async (input: {
  browser: BrowserTargetLease;
  runtimeLogger: RuntimeLogger;
  mission: AmazonInvoiceUploadMissionInput;
  execution: AmazonInvoiceUploadExecutionContext;
  stepName: string;
  traceStartedAtMs: number;
  snapshotBudgetMs: number;
}): Promise<OrderDetailObservation> => {
  let snapshot: DomSnapshot;
  try {
    snapshot = await readSnapshot(
      input.browser,
      { timeoutMs: input.snapshotBudgetMs },
      input.execution.abortSignal,
    );
  } catch (error) {
    const reason = `Order detail DOM observation failed within the 2-second window: ${error instanceof Error ? error.message : String(error)}`;
    recordOrderObservation({ ...input, status: "failed", reason });
    return {
      status: "technical_failure",
      result: buildOrderDetailTechnicalFailureResult(input.mission, reason),
    };
  }
  const gate = gatedResult(snapshot, input.mission, input.stepName);
  if (gate) {
    recordOrderObservation({
      ...input,
      status: "review_required",
      snapshot,
      reason: gate.reason,
    });
    return { status: "blocked", result: gate };
  }
  if (
    snapshotContainsApprovedOrder(snapshot, input.mission.amazonOrderId) &&
    snapshotHasInvoiceActionState(snapshot) &&
    !snapshotIsLoading(snapshot)
  ) {
    recordOrderObservation({
      ...input,
      status: "success",
      snapshot,
      reason:
        "Order detail showed the requested order id and invoice action state.",
    });
    return { status: "ready" };
  }
  return {
    status: "pending",
    reason: orderDetailReadinessFailureReason(
      snapshot,
      input.mission.amazonOrderId,
    ),
  };
};

export const waitForApprovedOrderDetail = async (
  browser: BrowserTargetLease,
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
  let lastReason =
    "Order detail page did not show the requested order id and invoice action state.";
  while (Date.now() < windowDeadlineMs) {
    const snapshotBudgetMs = windowDeadlineMs - Date.now();
    if (snapshotBudgetMs < 100) break;
    const observation = await observeOrderDetailOnce({
      browser,
      runtimeLogger,
      mission,
      execution,
      stepName,
      traceStartedAtMs,
      snapshotBudgetMs,
    });
    if (observation.status !== "pending") return observation;
    lastReason = observation.reason;
    const remainingWindowMs = windowDeadlineMs - Date.now();
    if (remainingWindowMs > 0) {
      await browser.wait(
        Math.min(ORDER_DETAIL_READY_POLL_INTERVAL_MS, remainingWindowMs),
        execution.abortSignal,
      );
    }
  }
  recordOrderObservation({
    runtimeLogger,
    mission,
    execution,
    stepName,
    traceStartedAtMs,
    status: "failed",
    reason: `${lastReason} The 2000ms observation window ${observationWindow}/${ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT} expired.`,
  });
  return { status: "not_ready", reason: lastReason };
};

export const waitForApprovedOrderDetailWindows = async (
  browser: BrowserTargetLease,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  execution: AmazonInvoiceUploadExecutionContext,
): Promise<OrderDetailWaitResult> => {
  let lastReason =
    "Order detail page did not show the requested order id and invoice action state.";
  for (
    let window = 1;
    window <= ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT;
    window += 1
  ) {
    const readiness = await waitForApprovedOrderDetail(
      browser,
      runtimeLogger,
      mission,
      execution,
      window,
    );
    if (readiness.status === "ready") return readiness;
    if (readiness.status === "blocked" || readiness.status === "technical_failure")
      return readiness;
    lastReason = readiness.reason;
    if (window < ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT) {
      recordAmazonDomStepTrace({
        runtimeLogger,
        mission,
        stepName: `continue same-page order readiness window ${window + 1}`,
        status: "snapshot",
        reason:
          "The preceding 2000ms observation failed. Continue on the same page without refresh or another navigation.",
      });
    }
  }
  return { status: "not_ready", reason: lastReason };
};

const orderDetailReadinessFailureReason = (
  snapshot: DomSnapshot,
  amazonOrderId: string,
): string => {
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

export const buildOrderDetailNotFoundResult = (
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

export const buildOrderDetailTechnicalFailureResult = (
  mission: AmazonInvoiceUploadMissionInput,
  reason: string,
): AmazonInvoiceUploadTaskResult =>
  taskResult({
    status: "review_required",
    reason: `Exact-target technical execution failed closed: ${reason}`,
    reachedStep: "observe approved order detail readiness",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  });
