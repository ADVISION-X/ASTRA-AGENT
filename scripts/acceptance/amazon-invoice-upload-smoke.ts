import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createRuntimeLogger } from "../../src/lib/runtime-logs/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import {
  getAmazonInvoiceUploadTaskStatus,
  runAmazonInvoiceUpload,
  startAmazonInvoiceUploadTask,
} from "../../src/plugins/amazon-invoice-upload/index.js";
import { extractOrderDomTotalAmount, parsePdfTotalAmount } from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-amount-check.js";
import type { DomSnapshot } from "../../src/types/dom-automation.js";
import type { BrowserDocumentRef, BrowserTargetRef } from "../../src/types/browser-target.js";
import {
  AmazonHangingOpenBrowserAdapter,
  AmazonSmokeBrowserAdapter,
  buildInvoicePdf,
  createDelayedInvoiceDialogFixturePaths,
  createNoActionsDialogFixturePaths,
  createSmokeFixturePaths,
} from "./amazon-invoice-upload-smoke-support.js";
import { verifyAlreadyUploadedInvoice } from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-existing.js";
import { assertPositiveAndNegativeConfirmationBoundary } from "./amazon-invoice-upload-smoke-boundary.js";

const assertSmokeResult = (result: Awaited<ReturnType<typeof runAmazonInvoiceUpload>>): void => {
  if (result.status === "upload_success" && result.reachedStep === "upload success verified") {
    return;
  }
  process.stdout.write(`[AMAZON-INVOICE-UPLOAD-SMOKE][FAIL] unexpected dry-run result: ${JSON.stringify(result)}\n`);
  process.exit(1);
};

async function main(): Promise<void> {
  const fixture = createSmokeFixturePaths();
  const launched = await chromium.launch({ headless: true });
  const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
  const browser = new AmazonSmokeBrowserAdapter(page, fixture.tmp);
  const runtimeLogPath = join(fixture.tmp, "runtime-logs", "amazon-smoke.jsonl");
  const runtimeLogger = createRuntimeLogger({ terminalEnabled: false, fileSink: { bundlePath: runtimeLogPath } });

  try {
    await runPrimaryUploadSmoke(browser, page, runtimeLogger, fixture, runtimeLogPath);
    assertPositiveAndNegativeConfirmationBoundary();
    await runUploadRecoveryScenarios(runtimeLogger);
    process.stdout.write("[AMAZON-INVOICE-UPLOAD-SMOKE][PASS] plugin dry-run flow reached upload_success with retained tab lifecycle\n");
  } finally {
    await launched.close();
  }
}

async function runPrimaryUploadSmoke(
  browser: AmazonSmokeBrowserAdapter,
  page: import("playwright").Page,
  runtimeLogger: ReturnType<typeof createRuntimeLogger>,
  fixture: ReturnType<typeof createSmokeFixturePaths>,
  runtimeLogPath: string,
): Promise<void> {
  const executionId = "amazon-smoke:INV-1";
  const result = await runAmazonInvoiceUpload(browser, runtimeLogger, {
    missionType: "amazon_invoice_upload",
    marketplace: "AE",
    amazonOrderId: "123-1234567-1234567",
    invoiceNo: "INV-1",
    invoicePdfPath: fixture.pdfPath,
    sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
  }, executionContext(fixture.tmp, runtimeLogger, "INV-1"));
  assertSmokeResult(result);
  assertNavigationProofAndLogs(result, fixture.tmp, runtimeLogPath, executionId);
  await assertPrimaryBrowserContract(browser, page);
  assertBackendPdfTextAmountReadable();
  assertSplitSellerCentralOrderTotalReadable();
  assertLongSellerCentralOrderTotalReadable();
}

async function assertPrimaryBrowserContract(browser: AmazonSmokeBrowserAdapter, page: import("playwright").Page): Promise<void> {
  if (browser.closeTargetCalls !== 0) {
    throw new Error(`Amazon invoice smoke must retain the order tab; closeTargetCalls=${browser.closeTargetCalls}`);
  }
  if (!browser.openReusePolicies.includes("reuse-exact-url")) {
    throw new Error("Amazon invoice smoke must bind the order-detail owner to the exact target URL.");
  }
  const uploadInvoiceClickCount = await page.evaluate(() => Number((window as typeof window & { uploadInvoiceClickCount?: number }).uploadInvoiceClickCount ?? 0));
  if (uploadInvoiceClickCount !== 1) {
    throw new Error(`A delayed current-order upload dialog must suppress retry clicks on the covered page entry; clicks=${uploadInvoiceClickCount}.`);
  }
  if (browser.duplicateOrderDetailOpenCount !== 0 || browser.fileUrlOpenCount !== 1) {
    throw new Error(`Amazon invoice smoke must open the order detail exactly once; opens=${browser.fileUrlOpenCount}, duplicates=${browser.duplicateOrderDetailOpenCount}`);
  }
  if (browser.domSnapshotTimeouts.length === 0 || browser.domSnapshotTimeouts.some((timeoutMs) => timeoutMs <= 0 || timeoutMs > 1_800)) {
    throw new Error(`Every Amazon invoice DOM snapshot must carry a production deadline no greater than 1800ms: ${JSON.stringify(browser.domSnapshotTimeouts)}`);
  }
  if (!browser.domSnapshotTimeouts.some((timeoutMs) => timeoutMs < 1_800)) {
    throw new Error(`Order-detail snapshots must clamp their deadline to the remaining 2-second window budget: ${JSON.stringify(browser.domSnapshotTimeouts)}`);
  }
}

async function runUploadRecoveryScenarios(runtimeLogger: ReturnType<typeof createRuntimeLogger>): Promise<void> {
  await assertNoActionsDialogRecovery(runtimeLogger, "recovers", "already_uploaded");
  await assertNoActionsDialogRecovery(runtimeLogger, "repeats", "review_required");
  await assertNoActionsDialogRecovery(runtimeLogger, "read_failure_recovers", "already_uploaded");
  await assertDelayedInvoiceDialogAndThen(runtimeLogger, "delayed_existing", "already_uploaded");
  await assertDelayedInvoiceDialogAndThen(runtimeLogger, "delayed_upload_ready", null);
  await assertAmountMismatchSkipsBeforeUpload(runtimeLogger);
  await assertUnreadablePdfSkipsBeforeUpload(runtimeLogger);
  await assertTaskServiceTimeoutGuard(runtimeLogger);
  await assertConcurrentTaskIsRejected(runtimeLogger);
}

async function assertDelayedInvoiceDialogAndThen(
  runtimeLogger: ReturnType<typeof createRuntimeLogger>,
  behavior: "delayed_existing" | "delayed_upload_ready",
  expectedStatus: "already_uploaded" | null,
): Promise<void> {
  const fixture = createDelayedInvoiceDialogFixturePaths(behavior);
  const launched = await chromium.launch({ headless: true });
  const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
  const browser = new AmazonSmokeBrowserAdapter(page, fixture.tmp);
  const abortController = new AbortController();
  try {
    await page.goto(pathToFileURL(fixture.htmlPath).href);
    const startedAt = Date.now();
    const result = await verifyAlreadyUploadedInvoice(browser, runtimeLogger, {
      missionType: "amazon_invoice_upload",
      marketplace: "AE",
      amazonOrderId: "123-1234567-1234567",
      invoiceNo: "INV-RECOVERY",
      invoicePdfPath: fixture.pdfPath,
      sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
    }, abortController.signal);
    if ((result?.status ?? null) !== expectedStatus) {
      throw new Error(`Delayed invoice dialog ${behavior} returned ${JSON.stringify(result)}.`);
    }
    if (Date.now() - startedAt < 2_000) {
      throw new Error(`Delayed invoice dialog ${behavior} was classified before its post-2s terminal DOM signal.`);
    }
    const manageInvoiceClickCount = await page.evaluate(() => Number((window as typeof window & { manageInvoiceClickCount?: number }).manageInvoiceClickCount ?? 0));
    if (manageInvoiceClickCount !== 1) {
      throw new Error(`Delayed invoice dialog ${behavior} must click Manage invoice exactly once; clicks=${manageInvoiceClickCount}.`);
    }
    if (browser.noActionsDialogDismissClicks !== 0 || browser.fileInputSetCalls !== 0) {
      throw new Error(`Delayed invoice dialog ${behavior} must not enter recovery or upload while proving the AND THEN gate.`);
    }
  } finally {
    abortController.abort();
    await launched.close();
  }
}

function assertNavigationProofAndLogs(
  result: Awaited<ReturnType<typeof runAmazonInvoiceUpload>>,
  dataDir: string,
  runtimeLogPath: string,
  executionId: string,
): void {
  const proof = result.orderNavigationProof;
  if (!proof) throw new Error("Order navigation proof is missing.");
  assertNavigationProofIdentity(proof, executionId);
  assertStoredNavigationProof(proof, dataDir, executionId);
  assertNavigationLogProof(proof, runtimeLogPath, executionId);
}

function assertNavigationProofIdentity(
  proof: NonNullable<Awaited<ReturnType<typeof runAmazonInvoiceUpload>>["orderNavigationProof"]>,
  executionId: string,
): void {
  if (proof.executionId !== executionId || proof.actionResult !== "success" || proof.observedUrlMatchesRequest !== true) {
    throw new Error(`Order navigation proof is incomplete: ${JSON.stringify(proof)}`);
  }
  if (!proof.browserActionId || !proof.evidenceRef || !proof.storageRef || !/^sha256:[a-f0-9]{64}$/.test(proof.integrityHash)) {
    throw new Error(`Order navigation proof lacks action/evidence/integrity identity: ${JSON.stringify(proof)}`);
  }
}

function assertStoredNavigationProof(
  proof: NonNullable<Awaited<ReturnType<typeof runAmazonInvoiceUpload>>["orderNavigationProof"]>,
  dataDir: string,
  executionId: string,
): void {
  const recordsPath = join(dataDir, "forensics", `records-${executionId.replace(/[^a-z0-9]/gi, "_").slice(0, 64)}.ndjson`);
  if (!existsSync(recordsPath)) throw new Error(`Navigation forensics file is missing: ${recordsPath}`);
  const storedRecords = readJsonLines(recordsPath);
  const stored = storedRecords.find((record) => record.recordRef === proof.evidenceRef);
  if (!stored) throw new Error(`Navigation evidence ref ${proof.evidenceRef} is not resolvable in ${recordsPath}.`);
  const { integrityHash, ...hashPayload } = stored;
  const recomputed = `sha256:${createHash("sha256").update(JSON.stringify(hashPayload), "utf8").digest("hex")}`;
  if (integrityHash !== proof.integrityHash || recomputed !== proof.integrityHash) {
    throw new Error(`Navigation evidence integrity mismatch: proof=${proof.integrityHash} stored=${integrityHash} recomputed=${recomputed}`);
  }
}

function assertNavigationLogProof(
  proof: NonNullable<Awaited<ReturnType<typeof runAmazonInvoiceUpload>>["orderNavigationProof"]>,
  runtimeLogPath: string,
  executionId: string,
): void {
  const events = readJsonLines(runtimeLogPath).filter((event) => event.traceId === executionId);
  const navigationEvents = events.filter((event) => String(event.eventType).startsWith("BROWSER_ACTION_"));
  const started = navigationEvents.filter((event) => event.eventType === "BROWSER_ACTION_STARTED");
  const terminal = navigationEvents.filter((event) => event.eventType === "BROWSER_ACTION_COMPLETED" || event.eventType === "BROWSER_ACTION_FAILED");
  if (started.length !== 1 || terminal.length !== 1 || started[0]?.capabilityCallId !== proof.browserActionId || terminal[0]?.capabilityCallId !== proof.browserActionId) {
    throw new Error(`Expected one truthful navigation started/terminal pair: ${JSON.stringify(navigationEvents)}`);
  }
  assertObservationLogs(events);
}

function assertObservationLogs(events: Array<Record<string, unknown>>): void {
  const observationStarts = events.filter((event) => event.eventType === "DOM_AUTOMATION_STEP_STARTED"
    && String(event.stepId).startsWith("amazon-dom:observe-approved-order-detail-readiness-window"));
  if (observationStarts.length !== 8 || new Set(observationStarts.map((event) => event.stepId)).size !== observationStarts.length) {
    throw new Error(`Expected eight distinct same-page readiness observation windows before the 15-second terminal signal: ${JSON.stringify(observationStarts)}`);
  }
  if (events.some((event) => event.eventType === "DOM_AUTOMATION_STEP_STARTED" && String(event.reason).includes("open approved order detail"))) {
    throw new Error("Same-page observation must never be logged as open approved order detail.");
  }
}

function readJsonLines(path: string): Array<Record<string, unknown>> {
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
}

async function assertNoActionsDialogRecovery(
  runtimeLogger: ReturnType<typeof createRuntimeLogger>,
  behavior: "recovers" | "repeats" | "read_failure_recovers",
  expectedStatus: "already_uploaded" | "review_required",
): Promise<void> {
  const fixture = createNoActionsDialogFixturePaths(behavior);
  const launched = await chromium.launch({ headless: true });
  const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
  const browser = new AmazonSmokeBrowserAdapter(page, fixture.tmp);
  try {
    const result = await runAmazonInvoiceUpload(browser, runtimeLogger, {
      missionType: "amazon_invoice_upload",
      marketplace: "AE",
      amazonOrderId: "123-1234567-1234567",
      invoiceNo: "INV-RECOVERY",
      invoicePdfPath: fixture.pdfPath,
      sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
    }, executionContext(fixture.tmp, runtimeLogger, `INV-RECOVERY-${behavior}`));
    if (result.status !== expectedStatus) {
      throw new Error(`No-actions dialog ${behavior} fixture returned ${JSON.stringify(result)}.`);
    }
    if (browser.noActionsDialogDismissClicks !== 1) {
      throw new Error(`No-actions dialog ${behavior} fixture must click outside exactly once; clicks=${browser.noActionsDialogDismissClicks}.`);
    }
    if (browser.duplicateOrderDetailOpenCount !== 0) {
      throw new Error(`No-actions dialog ${behavior} fixture must not refresh the order detail page.`);
    }
    if (browser.fileUrlOpenCount !== 1) {
      throw new Error(`No-actions dialog ${behavior} fixture must open the order detail exactly once; opens=${browser.fileUrlOpenCount}.`);
    }
    if (browser.fileInputSetCalls !== 0) {
      throw new Error(`No-actions dialog ${behavior} fixture must stop before PDF upload.`);
    }
  } finally {
    await launched.close();
  }
}

function assertBackendPdfTextAmountReadable(): void {
  const amount = parsePdfTotalAmount(`G R O S S A M O U N T P AYA B L E
( A E D )
59.50`);
  if (amount?.amountMinor !== 5950) {
    throw new Error(`Backend-rendered PDF text must be amount-readable: ${JSON.stringify(amount)}`);
  }
}

function assertSplitSellerCentralOrderTotalReadable(): void {
  const amount = extractOrderDomTotalAmount({
    targetRef: "bt_fixture" as BrowserTargetRef,
    documentRef: "bd_fixture" as BrowserDocumentRef,
    url: "https://sellercentral.amazon.ae/orders-v3/order/402-2948017-0456349",
    title: "亚马逊",
    forms: [],
    inputs: [],
    buttons: [],
    links: [],
    fileInputs: [],
    dialogs: [],
    frames: [],
    textBlocks: [
      textBlock("销售收益"),
      textBlock("商品总计:"),
      textBlock("AED 59.50"),
      textBlock("运费总额:"),
      textBlock("AED 2.50"),
      textBlock("促销总额:"),
      textBlock("-AED 2.50"),
      textBlock("总和:"),
      textBlock("AED 59.50"),
    ],
    tableRows: [],
    roleRows: [],
    genericClickableElements: [],
    dropdownTriggers: [],
    overlays: [],
    loadingIndicators: [],
    stickyElements: [],
    detectedStates: [],
    capturedAt: "1970-01-01T00:00:00.000Z",
  });
  if (amount?.amountMinor !== 5950) {
    throw new Error(`Split Seller Central total must be amount-readable: ${JSON.stringify(amount)}`);
  }
}

function assertLongSellerCentralOrderTotalReadable(): void {
  const amount = extractOrderDomTotalAmount({
    targetRef: "bt_fixture" as BrowserTargetRef,
    documentRef: "bd_fixture" as BrowserDocumentRef,
    url: "https://sellercentral.amazon.ae/orders-v3/order/402-2948017-0456349",
    title: "Amazon",
    forms: [],
    inputs: [],
    buttons: [],
    links: [],
    fileInputs: [],
    dialogs: [],
    frames: [],
    textBlocks: [
      textBlock(`Sales proceeds ${"Adjustment AED 0.00 ".repeat(18)} Total AED 59.50`),
    ],
    tableRows: [],
    roleRows: [],
    genericClickableElements: [],
    dropdownTriggers: [],
    overlays: [],
    loadingIndicators: [],
    stickyElements: [],
    detectedStates: [],
    capturedAt: "1970-01-01T00:00:00.000Z",
  });
  if (amount?.amountMinor !== 5950) {
    throw new Error(`Long Seller Central total must be amount-readable: ${JSON.stringify(amount)}`);
  }
}

function textBlock(visibleText: string): DomSnapshot["textBlocks"][number] {
  return { tagName: "div", visibleText, disabled: false, hidden: false, selectorCandidate: "div", candidateKind: "text" };
}

async function assertUnreadablePdfSkipsBeforeUpload(runtimeLogger: ReturnType<typeof createRuntimeLogger>): Promise<void> {
  const fixture = createSmokeFixturePaths();
  const unreadablePdfPath = join(fixture.tmp, "unreadable.pdf");
  writeFileSync(unreadablePdfPath, Buffer.from("%PDF-1.4\n% unreadable amount fixture\n"));
  const launched = await chromium.launch({ headless: true });
  const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
  const browser = new AmazonSmokeBrowserAdapter(page, fixture.tmp);
  try {
    const result = await runAmazonInvoiceUpload(browser, runtimeLogger, {
      missionType: "amazon_invoice_upload",
      marketplace: "AE",
      amazonOrderId: "123-1234567-1234567",
      invoiceNo: "INV-UNREADABLE",
      invoicePdfPath: unreadablePdfPath,
      sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
    }, executionContext(fixture.tmp, runtimeLogger, "INV-UNREADABLE"));
    if (result.status !== "amount_mismatch_skipped" || result.amountCheck?.status !== "pdf_unreadable") {
      throw new Error(`Unreadable PDF amount must skip before upload: ${JSON.stringify(result)}`);
    }
    if (browser.fileInputSetCalls !== 0) {
      throw new Error(`Unreadable PDF must not attach a file; fileInputSetCalls=${browser.fileInputSetCalls}`);
    }
  } finally {
    await launched.close();
  }
}

async function assertAmountMismatchSkipsBeforeUpload(runtimeLogger: ReturnType<typeof createRuntimeLogger>): Promise<void> {
  const fixture = createSmokeFixturePaths();
  const mismatchPdfPath = join(fixture.tmp, "mismatch.pdf");
  writeFileSync(mismatchPdfPath, buildInvoicePdf("39.07"));
  const launched = await chromium.launch({ headless: true });
  const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
  const browser = new AmazonSmokeBrowserAdapter(page, fixture.tmp);
  try {
    const result = await runAmazonInvoiceUpload(browser, runtimeLogger, {
      missionType: "amazon_invoice_upload",
      marketplace: "AE",
      amazonOrderId: "123-1234567-1234567",
      invoiceNo: "INV-MISMATCH",
      invoicePdfPath: mismatchPdfPath,
      sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
    }, executionContext(fixture.tmp, runtimeLogger, "INV-MISMATCH"));
    if (result.status !== "amount_mismatch_skipped" || result.reachedStep !== "verify invoice amount against order total") {
      throw new Error(`Amount mismatch must skip before upload: ${JSON.stringify(result)}`);
    }
    if (browser.fileInputSetCalls !== 0) {
      throw new Error(`Amount mismatch must not attach a PDF; fileInputSetCalls=${browser.fileInputSetCalls}`);
    }
  } finally {
    await launched.close();
  }
}

async function assertTaskServiceTimeoutGuard(runtimeLogger: ReturnType<typeof createRuntimeLogger>): Promise<void> {
  const fixture = createSmokeFixturePaths();
  const browser = new AmazonHangingOpenBrowserAdapter();
  const task = await startAmazonInvoiceUploadTask({
    browser,
    runtimeLogger,
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(fixture.tmp), runtimeLogger),
    dataDir: fixture.tmp,
    flowTimeoutMs: 20,
    task: {
      mission: {
        missionType: "amazon_invoice_upload",
        marketplace: "AE",
        amazonOrderId: "123-1234567-1234567",
        invoiceNo: "INV-TIMEOUT",
        invoicePdfPath: fixture.pdfPath,
        sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
      },
      invoicePdf: {
        filename: "INV-TIMEOUT.pdf",
        mimeType: "application/pdf",
        bytes: Buffer.from("timeout pdf"),
      },
    },
  });
  const persisted = getAmazonInvoiceUploadTaskStatus({ dataDir: fixture.tmp, taskId: task.taskId });
  if (persisted.status !== "review_required" || persisted.reason !== "amazon_invoice_upload_flow_timeout_after_20ms") {
    throw new Error(`Amazon invoice upload task timeout guard failed: ${JSON.stringify(persisted)}`);
  }
  if (browser.openCalls !== 1 || browser.abortCount !== 1) {
    throw new Error(`Timeout must abort and settle the one active browser open: opens=${browser.openCalls} aborts=${browser.abortCount}`);
  }
  const settledOpenCalls = browser.openCalls;
  await new Promise((resolve) => setTimeout(resolve, 30));
  if (browser.openCalls !== settledOpenCalls) throw new Error("Timed-out upload flow produced a later browser action after terminal persistence.");
}

async function assertConcurrentTaskIsRejected(runtimeLogger: ReturnType<typeof createRuntimeLogger>): Promise<void> {
  const fixture = createSmokeFixturePaths();
  const browser = new AmazonHangingOpenBrowserAdapter();
  const evidenceStore = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(fixture.tmp), runtimeLogger);
  const taskInput = (invoiceNo: string, flowTimeoutMs: number) => ({
    browser,
    runtimeLogger,
    evidenceStore,
    dataDir: fixture.tmp,
    flowTimeoutMs,
    task: {
      mission: {
        missionType: "amazon_invoice_upload" as const,
        marketplace: "AE" as const,
        amazonOrderId: "123-1234567-1234567",
        invoiceNo,
        invoicePdfPath: fixture.pdfPath,
        sellerCentralEntryUrl: pathToFileURL(fixture.htmlPath).href,
      },
      invoicePdf: { filename: `${invoiceNo}.pdf`, mimeType: "application/pdf", bytes: Buffer.from("concurrency pdf") },
    },
  });
  const firstPromise = startAmazonInvoiceUploadTask(taskInput("INV-CONCURRENT-1", 80));
  for (let attempt = 0; attempt < 20 && browser.openCalls === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  const second = await startAmazonInvoiceUploadTask(taskInput("INV-CONCURRENT-2", 80));
  if (second.status !== "review_required" || second.reason !== "amazon_invoice_upload_busy: another invoice execution owns the shared browser" || second.reachedStep !== "execution lease") {
    throw new Error(`Concurrent second task must fail busy before browser control: ${JSON.stringify(second)}`);
  }
  const first = await firstPromise;
  if (first.status !== "review_required" || first.reason !== "amazon_invoice_upload_flow_timeout_after_80ms" || browser.openCalls !== 1 || browser.abortCount !== 1) {
    throw new Error(`Single-flight/timeout contract failed: first=${JSON.stringify(first)} opens=${browser.openCalls} aborts=${browser.abortCount}`);
  }
}

function executionContext(
  dataDir: string,
  runtimeLogger: ReturnType<typeof createRuntimeLogger>,
  suffix: string,
) {
  return {
    executionId: `amazon-smoke:${suffix}`,
    abortSignal: new AbortController().signal,
    evidenceStore: createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(dataDir), runtimeLogger),
    runtimeLogRef: "runtime-logs/amazon-smoke.jsonl",
  };
}

await main();
