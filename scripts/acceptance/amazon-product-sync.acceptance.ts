import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strict as assert } from "node:assert";

import type {
  BrowserActionResult,
  BrowserCaptureResult,
  BrowserController,
  BrowserGeometrySnapshot,
  BrowserStateSnapshot,
} from "../../src/lib/browser/browser-controller.js";
import {
  getAmazonProductSyncTaskStatus,
  startAmazonProductSyncTask,
} from "../../src/plugins/amazon-product-sync/index.js";

const now = (): string => new Date().toISOString();

const action = (message: string): BrowserActionResult => ({
  browserActionId: `amazon-product-sync-acceptance:${Date.now()}`,
  ok: true,
  message,
  createdAt: now(),
});

class AmazonProductSyncFakeBrowser implements BrowserController {
  openedUrls: string[] = [];
  evaluateCalls = 0;
  getHealth() { return { ok: true, detail: "amazon product sync fake browser" }; }
  getSessionState(): BrowserStateSnapshot {
    return {
      browserMode: "fixture",
      browserProfileRef: "fixture",
      browserExecutablePath: null,
      profileStatus: "profile_ready",
      profileDirectory: "fixture",
      profileProvisioning: "operator_supplied",
      profileVerificationStatus: "operator_verified",
      profileVerificationReason: "fixture",
      loginState: "unknown",
      currentUrl: this.openedUrls.at(-1) ?? "about:blank",
      lastLoginCheckAt: null,
      loginRequiredReason: null,
      reviewRequiredReason: null,
      open: true,
      currentTitle: "Manage Your Inventory",
      browserExecutable: null,
    };
  }
  async getGeometrySnapshot(): Promise<BrowserGeometrySnapshot> {
    return {
      windowX: 0,
      windowY: 0,
      viewportWidth: 1200,
      viewportHeight: 800,
      screenshotWidth: 1200,
      screenshotHeight: 800,
      scaleFactor: 1,
      currentUrl: this.getSessionState().currentUrl,
      pageTitle: "Manage Your Inventory",
      visibleContentBounds: { x: 0, y: 0, width: 1200, height: 800 },
      capturedAt: now(),
    };
  }
  async open(input: { url: string }): Promise<BrowserActionResult> {
    this.openedUrls.push(input.url);
    return action("opened seller central inventory");
  }
  async scroll(): Promise<BrowserActionResult> { return action("scroll"); }
  async click(): Promise<BrowserActionResult> { return action("click"); }
  async clickLocatedDomElement(): Promise<BrowserActionResult> { return action("clickLocatedDomElement"); }
  async textInput(): Promise<BrowserActionResult> { return action("textInput"); }
  async screenshotRegion(): Promise<BrowserCaptureResult> {
    return {
      browserActionId: "fixture-capture",
      pageUrl: this.getSessionState().currentUrl,
      pageTitle: "Manage Your Inventory",
      regionLabel: "fixture",
      regionType: "viewport",
      width: 1200,
      height: 800,
      viewportWidth: 1200,
      viewportHeight: 800,
      sourceFilePath: "/tmp/fixture.png",
      createdAt: now(),
    };
  }
  async evaluateActiveTab<T>(): Promise<T> {
    this.evaluateCalls += 1;
    if (this.evaluateCalls === 1) {
      return { collapsedCount: 0, points: [] } as T;
    }
    return {
      url: "https://sellercentral.amazon.ae/myinventory/inventory",
      title: "Manage Your Inventory",
      detectedState: "ready",
      rows: [
        {
          sellerSku: "DL-UG6I-2OWL",
          asinSnapshot: "B012345678",
          sellerCentralTitleSnapshot: "Acceptance Product Title",
          imageSrc: "https://example.invalid/image.jpg",
          listingStatus: "active",
          availableFbaUnits: 28,
          inboundUnits: 0,
          unfulfillableUnits: 0,
          reservedUnits: 0,
          sales30dSnapshot: 4,
        },
      ],
    } as T;
  }
  async setFileInputFiles(): Promise<BrowserActionResult> { return action("setFileInputFiles"); }
  async wait(): Promise<BrowserActionResult> { return action("wait"); }
  async closeActiveTab(): Promise<BrowserActionResult> { return action("closeActiveTab"); }
  async close(): Promise<BrowserActionResult> { return action("close"); }
}

const waitForTerminal = async (dataDir: string, taskId: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const task = await getAmazonProductSyncTaskStatus({ dataDir, taskId });
    if (task && task.status !== "queued" && task.status !== "running") {
      return task;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("amazon product sync task did not reach terminal status");
};

const dataDir = mkdtempSync(join(tmpdir(), "amazon-product-sync-acceptance-"));
const browser = new AmazonProductSyncFakeBrowser();
const started = await startAmazonProductSyncTask({
  requestId: "acceptance-amazon-product-sync-1",
  marketplace: "amazon.ae",
  scope: "selected-skus",
  requestedAt: now(),
  items: [{ sourceKeyType: "sku", sourceKey: "DL-UG6I-2OWL", sellerSku: "DL-UG6I-2OWL" }],
}, { dataDir, browser });

assert.equal(started.status, "running");
const terminal = await waitForTerminal(dataDir, started.taskId);
assert.equal(terminal.status, "success");
assert.equal(terminal.items[0]?.status, "matched");
assert.equal(terminal.items[0]?.availableFbaUnits, 28);
assert.ok(terminal.items[0]?.rowEvidenceRef?.startsWith("evidence://amazon-product-sync/"));
process.stdout.write("[AMAZON-PRODUCT-SYNC][PASS] read-only SKU inventory sync acceptance passed\n");
