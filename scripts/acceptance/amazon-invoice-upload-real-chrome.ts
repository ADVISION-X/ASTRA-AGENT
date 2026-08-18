import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";

import { createAmazonInvoiceUploadPlugin } from "../../src/plugins/amazon-invoice-upload/index.js";
import { createBrowserControllerAmazonInvoiceDomAdapter } from "../../src/plugins/amazon-invoice-upload/browser-controller-dom-adapter.js";
import { createFileEvidenceStore } from "../../src/lib/evidence/file-evidence-store.js";
import { CurrentChromeBrowserController } from "../../src/lib/browser/current-chrome-browser-controller.js";
import { resolveProductionBrowserProfileEnrollment } from "../../src/lib/browser/profile/browser-profile-config.js";
import { RuntimeLogEventType, RuntimeLogMode, createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import type { BrowserController } from "../../src/lib/browser/browser-controller.js";
import type {
  BatchInvoiceInput,
  InvoiceTask,
  UploadBatch,
} from "../../src/plugins/amazon-invoice-upload/contracts.js";

const platformTarget = (process.argv[2] ?? "amazon-us") as InvoiceTask["platformTarget"];
const invoiceUrl = process.argv[3];
const orderHint = process.argv[4];
const batchId = process.argv[5] ?? `grasseye-real-${Date.now()}`;

if (!invoiceUrl) throw new Error("invoice URL required as argv[3]");
if (!orderHint) throw new Error("order hint required as argv[4]");
if (process.env.GRASSEYE_RUN_REAL_CHROME_ACCEPTANCE !== "1") {
  process.stdout.write("amazon-invoice-upload-real-chrome SKIP: set GRASSEYE_RUN_REAL_CHROME_ACCEPTANCE=1 for packaged Authority V2 proof\n");
  process.exit(0);
}

const dataDir = process.env.GRASSEYE_REAL_CHROME_DATA_DIR
  ?? await mkdtemp(path.join(tmpdir(), "grasseye-amazon-authority-v2-"));
const ownDataDir = !process.env.GRASSEYE_REAL_CHROME_DATA_DIR;
await mkdir(dataDir, { recursive: true });

const runtimeLogger = createRuntimeLogger({
  mode: RuntimeLogMode.DEBUG,
  consoleEnabled: true,
});

const profileEnrollment = resolveProductionBrowserProfileEnrollment({
  platform: process.platform,
  ...(process.env.GRASSEYE_BROWSER_PROFILE_DIRECTORY
    ? { profileDirectory: process.env.GRASSEYE_BROWSER_PROFILE_DIRECTORY }
    : {}),
});
const browser: BrowserController = await CurrentChromeBrowserController.create({
  profileEnrollment,
  screenshotDir: path.join(dataDir, "captures"),
  dataDir,
  authorityTimeoutMs: 30_000,
}, runtimeLogger);

if (browser.getAuthoritySnapshot().state !== "AUTHENTICATED_AUTHORITY_PRESENT") {
  throw new Error("amazon real-chrome harness requires committed Browser Authority V2 before plugin construction");
}

const targetSession = browser.createTargetSession(`amazon-invoice-real:${batchId}`);
const dom = createBrowserControllerAmazonInvoiceDomAdapter({
  browser: targetSession,
  platformTarget,
  runtimeLogger,
  ownerId: `amazon-invoice-real:${batchId}`,
});
const evidenceStore = createFileEvidenceStore({ dataDir });
const plugin = createAmazonInvoiceUploadPlugin({
  dataDir,
  runtimeLogger,
  evidenceStore,
  browser: targetSession,
  dom,
});

const batch: UploadBatch = {
  batchId,
  createdAt: new Date().toISOString(),
  platformTarget,
  status: "pending",
  policy: {
    stopOnFirstManualReview: true,
    stopOnFirstFailure: true,
  },
  tasks: [
    {
      taskId: `${batchId}:1`,
      platformTarget,
      sequence: 1,
      invoice: {
        invoiceRef: `${batchId}:invoice:1`,
        invoiceUrl,
        expectedContentType: "application/pdf",
        expectedFileExtension: ".pdf",
      },
      orderHint,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
};

const batchInput: BatchInvoiceInput = {
  batchId: batch.batchId,
  createdAt: batch.createdAt,
  platformTarget: batch.platformTarget,
  policy: batch.policy,
  tasks: batch.tasks.map((task) => ({
    taskId: task.taskId,
    invoice: task.invoice,
    orderHint: task.orderHint,
  })),
};

runtimeLogger.emit({
  traceId: batchId,
  level: "info",
  modeVisibility: [RuntimeLogMode.FLOW, RuntimeLogMode.DEBUG],
  eventType: RuntimeLogEventType.FLOW_STAGE_STARTED,
  owner: "amazon-invoice-upload-real-chrome",
  status: "started",
  reason: "starting packaged real Chrome invoice acceptance under authenticated Browser Authority V2",
  payload: {
    actionKind: "real_chrome_invoice_acceptance",
    platformTarget,
    browserAuthorityState: browser.getAuthoritySnapshot().state,
  },
});

let result: unknown;
try {
  result = await plugin.runBatch(batchInput);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} finally {
  await plugin.shutdown?.().catch(() => undefined);
  await browser.close().catch(() => undefined);
  if (ownDataDir) await rm(dataDir, { recursive: true, force: true });
}
