import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { BrowserOpenReusePolicy } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { gatedResult, readSnapshot, taskResult } from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";

type DomSnapshot = Awaited<ReturnType<typeof readSnapshot>>;

const ORDER_DETAIL_READY_TIMEOUT_MS = 2_000;
const ORDER_DETAIL_READY_POLL_INTERVAL_MS = 200;
const ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT = 3;

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
  let lastReason = "Order detail page did not show the requested order id and invoice action state.";
  for (let window = 1; window <= ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT; window += 1) {
    const readiness = await waitForApprovedOrderDetail(browser, runtimeLogger, mission, window);
    if (readiness.status === "ready") return null;
    if (readiness.status === "blocked") return readiness.result;
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
  return buildOrderDetailNotFoundResult(mission, lastReason);
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
  observationWindow: number,
): Promise<OrderDetailWaitResult> => {
  const startedAt = Date.now();
  let lastReason = "Order detail page did not show the requested order id and invoice action state.";
  while (Date.now() - startedAt < ORDER_DETAIL_READY_TIMEOUT_MS) {
    let snapshot: DomSnapshot;
    try {
      snapshot = await readSnapshot(browser);
    } catch (error) {
      lastReason = `Order detail DOM observation failed within the 2-second window: ${error instanceof Error ? error.message : String(error)}`;
      break;
    }
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
      return { status: "ready" };
    }
    lastReason = orderDetailReadinessFailureReason(snapshot, mission.amazonOrderId);
    await browser.wait(ORDER_DETAIL_READY_POLL_INTERVAL_MS);
  }
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "open approved order detail",
    status: "failed",
    reason: `${lastReason} The 2000ms observation window ${observationWindow}/${ORDER_DETAIL_OBSERVATION_WINDOW_LIMIT} expired.`,
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
