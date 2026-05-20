import { readDomSnapshotOnce } from "../../capabilities/dom-automation/index.js";
import type { BrowserController } from "../../lib/browser/browser-controller.js";
import { taskResult } from "./amazon-invoice-upload-flow-support.js";
import type { AmazonInvoiceUploadTaskResult } from "./amazon-invoice-upload.flow.js";
import type { AmazonInvoiceUploadMissionInput } from "./mission.schema.js";

type DomSnapshot = Awaited<ReturnType<typeof readDomSnapshotOnce>>;

export async function openApprovedOrderDetail(
  browser: BrowserController,
  mission: AmazonInvoiceUploadMissionInput,
): Promise<AmazonInvoiceUploadTaskResult | null> {
  const detailUrl = buildApprovedOrderDetailUrl(mission);
  await browser.open({ url: detailUrl, title: "Amazon Seller Central approved order detail" });
  await reloadApprovedOrderDetail(browser, detailUrl);
  return await waitForApprovedOrderDetail(browser, mission, detailUrl) ? null : buildOrderDetailNotFoundResult(mission);
}

function buildApprovedOrderDetailUrl(mission: AmazonInvoiceUploadMissionInput): string {
  const url = new URL(mission.sellerCentralEntryUrl);
  if (url.protocol === "file:") return mission.sellerCentralEntryUrl;
  url.pathname = `/orders-v3/order/${encodeURIComponent(mission.amazonOrderId)}`;
  url.search = "";
  return url.toString();
}

const reloadApprovedOrderDetail = (browser: BrowserController, detailUrl: string): Promise<unknown> =>
  browser.evaluateActiveTab({
    description: "force approved order detail reload for task-clean page state",
    script: `if (location.href === ${JSON.stringify(detailUrl)}) { location.reload(); return {status: "reloading"}; } return {status: "not_current_detail"};`,
  });

const snapshotContainsApprovedOrder = (snapshot: DomSnapshot, amazonOrderId: string): boolean =>
  [
    snapshot.url,
    ...snapshot.tableRows.map((item) => item.visibleText),
    ...snapshot.roleRows.map((item) => item.visibleText),
    ...snapshot.textBlocks.map((item) => item.visibleText),
    ...snapshot.links.map((item) => item.visibleText),
    ...snapshot.buttons.map((item) => item.visibleText),
  ].some((value) => String(value ?? "").includes(amazonOrderId));

const snapshotIsLoading = (snapshot: DomSnapshot): boolean =>
  [...snapshot.textBlocks.map((item) => item.visibleText), ...snapshot.dialogs.map((item) => item.visibleText)]
    .some((value) => String(value ?? "").includes("正在加载"));

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
  mission: AmazonInvoiceUploadMissionInput,
  detailUrl: string,
): Promise<boolean> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 9000) {
    await browser.wait(1000);
    const snapshot = await readDomSnapshotOnce(browser);
    if (snapshotContainsApprovedOrder(snapshot, mission.amazonOrderId) && !snapshotIsLoading(snapshot)) {
      await browser.wait(1200);
      return true;
    }
    await retryOrderDetailIfNeeded(browser, snapshot, detailUrl, mission.amazonOrderId);
  }
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
