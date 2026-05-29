import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { BrowserOpenReusePolicy } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { gatedResult, readSnapshot, taskResult } from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";

type DomSnapshot = Awaited<ReturnType<typeof readSnapshot>>;

const ORDER_DETAIL_READY_WAIT_MIN_MS = 7_000;
const ORDER_DETAIL_READY_WAIT_MAX_MS = 15_000;
const ORDER_DETAIL_RECOVERY_REFRESH_WAIT_MIN_MS = 2_000;
const ORDER_DETAIL_RECOVERY_REFRESH_WAIT_MAX_MS = 4_000;

type OrderDetailWaitResult =
  | { status: "ready" }
  | { status: "blocked"; result: AmazonInvoiceUploadTaskResult }
  | { status: "not_ready"; reason: string };

export async function openApprovedOrderDetail(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const detailUrl = buildApprovedOrderDetailUrl(mission);
  await browser.open({
    url: detailUrl,
    title: "Amazon Seller Central approved order detail",
    reusePolicy: await orderDetailReusePolicy(browser, detailUrl),
  });
  const initialReady = await waitForApprovedOrderDetail(browser, runtimeLogger, mission, detailUrl, {
    timeoutMs: randomOrderDetailReadyWaitMs(),
    finalTrace: false,
  });
  if (initialReady.status === "ready") return null;
  if (initialReady.status === "blocked") return initialReady.result;

  await refreshApprovedOrderDetailIfNeeded(browser, runtimeLogger, mission, detailUrl, initialReady.reason);
  const finalReady = await waitForApprovedOrderDetail(browser, runtimeLogger, mission, detailUrl, {
    timeoutMs: 7_000,
    finalTrace: true,
  });
  if (finalReady.status === "ready") return null;
  if (finalReady.status === "blocked") return finalReady.result;
  return buildOrderDetailNotFoundResult(mission);
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

function buildApprovedOrderDetailUrl(mission: AmazonInvoiceUploadMissionInput): string {
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

const randomWaitMs = (minMs: number, maxMs: number): number =>
  minMs + Math.floor(Math.random() * (maxMs - minMs + 1));

const randomOrderDetailReadyWaitMs = (): number =>
  randomWaitMs(ORDER_DETAIL_READY_WAIT_MIN_MS, ORDER_DETAIL_READY_WAIT_MAX_MS);

const randomOrderDetailRecoveryRefreshWaitMs = (): number =>
  randomWaitMs(ORDER_DETAIL_RECOVERY_REFRESH_WAIT_MIN_MS, ORDER_DETAIL_RECOVERY_REFRESH_WAIT_MAX_MS);

async function refreshApprovedOrderDetailIfNeeded(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  detailUrl: string,
  readinessFailureReason: string,
): Promise<void> {
  await browser.open({ url: detailUrl, title: "Amazon Seller Central approved order detail refresh", reusePolicy: "reuse-active-tab" });
  const waitMs = randomOrderDetailRecoveryRefreshWaitMs();
  await browser.wait(waitMs);
  const snapshot = await readSnapshot(browser);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "refresh approved order detail after readiness timeout",
    status: "snapshot",
    snapshot,
    reason: `Order detail recovery refresh executed once after missing readiness markers: ${readinessFailureReason}; waited ${waitMs}ms.`,
  });
}

const retryOrderDetailIfNeeded = (
  browser: BrowserController,
  snapshot: DomSnapshot,
  detailUrl: string,
  amazonOrderId: string,
): Promise<unknown> | null =>
  snapshot.url.includes(`/orders-v3/order/${amazonOrderId}`)
    ? null
    : browser.open({ url: detailUrl, title: "Amazon Seller Central approved order detail retry", reusePolicy: "reuse-active-tab" });

const waitForApprovedOrderDetail = async (
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  detailUrl: string,
  options: { timeoutMs: number; finalTrace: boolean },
): Promise<OrderDetailWaitResult> => {
  const startedAt = Date.now();
  let lastReason = "Order detail page did not show the requested order id and invoice action state.";
  while (Date.now() - startedAt < options.timeoutMs) {
    const snapshot = await readSnapshot(browser);
    const gate = gatedResult(snapshot, mission, "open approved order detail");
    if (gate) return { status: "blocked", result: gate };
    if (
      snapshotContainsApprovedOrder(snapshot, mission.amazonOrderId)
      && snapshotHasInvoiceActionState(snapshot)
      && !snapshotIsLoading(snapshot)
    ) {
      recordAmazonDomStepTrace({
        runtimeLogger,
        mission,
        stepName: "open approved order detail",
        status: "success",
        snapshot,
        reason: "Order detail showed the requested order id and invoice action state.",
      });
      await browser.wait(100);
      return { status: "ready" };
    }
    lastReason = orderDetailReadinessFailureReason(snapshot, mission.amazonOrderId);
    await retryOrderDetailIfNeeded(browser, snapshot, detailUrl, mission.amazonOrderId);
    await browser.wait(350);
  }
  if (options.finalTrace) {
    recordAmazonDomStepTrace({
      runtimeLogger,
      mission,
      stepName: "open approved order detail",
      status: "failed",
      reason: lastReason,
    });
  }
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
): AmazonInvoiceUploadTaskResult =>
  taskResult({
    status: "order_not_found",
    reason: "Approved order detail page did not show the requested Amazon order id.",
    reachedStep: "open approved order detail",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
  });
