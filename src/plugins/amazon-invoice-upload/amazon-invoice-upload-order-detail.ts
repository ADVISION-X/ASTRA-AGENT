import type { BrowserController } from "../../lib/browser/browser-controller.js";
import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { readSnapshot, taskResult } from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";

type DomSnapshot = Awaited<ReturnType<typeof readSnapshot>>;

const ORDER_DETAIL_REFRESH_WAIT_MIN_MS = 3_000;
const ORDER_DETAIL_REFRESH_WAIT_MAX_MS = 6_000;

export async function openApprovedOrderDetail(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const detailUrl = buildApprovedOrderDetailUrl(mission);
  await browser.open({ url: detailUrl, title: "Amazon Seller Central approved order detail" });
  await refreshApprovedOrderDetailOnce(browser, runtimeLogger, mission, detailUrl);
  return await waitForApprovedOrderDetail(browser, runtimeLogger, mission, detailUrl) ? null : buildOrderDetailNotFoundResult(mission);
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

const randomOrderDetailRefreshWaitMs = (): number =>
  ORDER_DETAIL_REFRESH_WAIT_MIN_MS
  + Math.floor(Math.random() * (ORDER_DETAIL_REFRESH_WAIT_MAX_MS - ORDER_DETAIL_REFRESH_WAIT_MIN_MS + 1));

async function refreshApprovedOrderDetailOnce(
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  detailUrl: string,
): Promise<void> {
  await browser.open({ url: detailUrl, title: "Amazon Seller Central approved order detail refresh" });
  const waitMs = randomOrderDetailRefreshWaitMs();
  await browser.wait(waitMs);
  const snapshot = await readSnapshot(browser);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "refresh approved order detail before upload",
    status: "snapshot",
    snapshot,
    reason: `Order detail refreshed once before upload entry detection; waited ${waitMs}ms.`,
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
    : browser.open({ url: detailUrl, title: "Amazon Seller Central approved order detail retry" });

const waitForApprovedOrderDetail = async (
  browser: BrowserController,
  runtimeLogger: RuntimeLogger,
  mission: AmazonInvoiceUploadMissionInput,
  detailUrl: string,
): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 7000) {
    const snapshot = await readSnapshot(browser);
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
      return true;
    }
    await retryOrderDetailIfNeeded(browser, snapshot, detailUrl, mission.amazonOrderId);
    await browser.wait(350);
  }
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "open approved order detail",
    status: "failed",
    reason: "Order detail page did not show the requested order id and invoice action state.",
  });
  return false;
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
