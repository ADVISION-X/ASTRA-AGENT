import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

import { renderAmazonInvoiceClient } from "../../src/app/workbench-home-amazon-invoice-client.js";

const repoRoot = process.cwd();
const read = (path: string): string => readFileSync(join(repoRoot, path), "utf8");

const client = read("src/app/workbench-home-amazon-invoice-client.ts");
const homeClient = read("src/app/workbench-home-client.ts");
const layout = read("src/app/app-shell/amazon-invoice-workspace.ts");
const routes = read("src/app/workbench-amazon-routes.ts");
const boundary = read("src/app/workbench-api-boundary.ts");
const workbenchHandle = read("src/lib/local-runtime/workbench-handle.ts");
const amazonHandle = read("src/lib/local-runtime/workbench-amazon-invoice-handle.ts");
const missionSchema = read("src/plugins/amazon-invoice-upload/mission.schema.ts");
const pluginIndex = read("src/plugins/amazon-invoice-upload/index.ts");
const taskService = read("src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.ts");
const browserController = read("src/lib/browser/browser-controller.ts");
const exactTargetRuntime = read("src/lib/browser/exact-target/browser-command-runtime.ts");

const obsoleteBackendBatchFiles = [
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch.types.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-storage.ts",
  "src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-service.ts",
] as const;

const obsoleteBackendBatchRoutes = [
  "/api/plugins/amazon-invoice-upload/batch/start",
  "/api/plugins/amazon-invoice-upload/batch/status/",
  "/api/plugins/amazon-invoice-upload/batch/latest",
  "/api/plugins/amazon-invoice-upload/batch/history",
] as const;

const obsoleteBackendBatchSymbols = [
  "startAmazonInvoiceUploadBatchTask",
  "getAmazonInvoiceUploadBatchStatus",
  "getLatestAmazonInvoiceUploadBatch",
  "listAmazonInvoiceUploadBatches",
  "AmazonInvoiceUploadBatchMissionInputSchema",
] as const;

for (const filePath of obsoleteBackendBatchFiles) {
  assert.equal(existsSync(join(repoRoot, filePath)), false, `${filePath} must not exist; it was the huge-multipart backend batch mode.`);
}

for (const route of obsoleteBackendBatchRoutes) {
  for (const [label, source] of Object.entries({ client, homeClient, routes, boundary })) {
    assert.equal(source.includes(route), false, `${label} must not reference obsolete backend batch route ${route}.`);
  }
}

for (const symbol of obsoleteBackendBatchSymbols) {
  for (const [label, source] of Object.entries({ workbenchHandle, amazonHandle, missionSchema, pluginIndex, taskService })) {
    assert.equal(source.includes(symbol), false, `${label} must not expose obsolete backend batch symbol ${symbol}.`);
  }
}

assert(layout.includes("data-amazon-invoice-batch-form"), "APP must keep the Batch Upload surface.");
assert(layout.includes('name="invoicePdfs" type="file"'), "Batch Upload must keep a multiple PDF selector.");
assert(layout.includes("multiple required"), "Batch Upload selector must support large multi-select from the local folder.");
assert(layout.includes("Start Batch Upload"), "Batch Upload must keep the user action.");
assert(layout.includes("data-amazon-invoice-upload-ledger-list"), "Ledger must show persisted single-upload task records.");
assert.equal(layout.includes("Latest Batch"), false, "APP must not expose obsolete backend batch latest mode.");
assert.equal(layout.includes("Batch Ledger"), false, "APP must not expose obsolete backend batch ledger mode.");

assert(client.includes("parseAmazonInvoiceBatchFileName"), "Local queue must parse orderId/invoiceNo from filename.");
assert(client.includes("ensureAmazonInvoiceBackendReady"), "Local queue must health-check backend before large runs.");
assert(client.includes("backend_unreachable"), "Local queue must surface backend_unreachable.");
assert(client.includes("AMAZON_INVOICE_BATCH_ITEM_RENDER_LIMIT"), "Local queue must cap rendered rows for huge selections.");
assert(client.includes("compactAmazonInvoiceBatchRecord"), "Local queue must compact rendered records.");
assert(client.includes("amazonInvoiceLocalQueueCounterKey"), "Local queue must update counters incrementally.");
assert(client.includes("loadAmazonInvoiceUploadLedgerIndex"), "Local queue must read the existing upload ledger before per-file upload.");
assert(client.includes("upload_ledger_preflight_failed"), "Local queue must fail closed when the upload ledger preflight cannot be read.");
assert(client.includes("skipped_by_upload_ledger"), "Local queue must visibly skip orders already proven by upload ledger.");
assert(client.includes("upload ledger preflight"), "Local queue skipped items must record the ledger preflight step.");
assert(client.includes("amazonInvoiceBatchRunning"), "Local queue must own one in-flight batch latch.");
assert(client.includes("batch_already_running"), "Repeated batch submit must fail closed before another request loop.");
assert(client.includes("duplicate_order_id_in_batch"), "Duplicate complete order ids in one selection must be invalid before upload.");
assert(client.includes("AMAZON_INVOICE_INTER_ITEM_DELAY_MIN_MS = 2000"), "Inter-item pacing must have the fixed 2-second lower bound.");
assert(client.includes("AMAZON_INVOICE_INTER_ITEM_DELAY_MAX_MS = 15000"), "Inter-item pacing must have the fixed 15-second upper bound.");
assert(client.includes("crypto.getRandomValues"), "Inter-item pacing must use browser cryptographic entropy.");
assert.equal(client.includes("Math.random"), false, "Inter-item pacing must not use Math.random.");
assert(client.includes('status: "inter_item_pacing"'), "Inter-item pacing must be visible in the batch lifecycle state.");
assert(client.includes("pendingInterItemDelay"), "The local queue must carry one pending delay across ledger-only skips.");
assert(client.includes("single_upload_transport_outcome_unknown"), "Unknown single-upload transport outcomes must stop for review instead of advancing.");
const amountMismatchBranchIndex = client.indexOf('record.status === "amount_mismatch_skipped"');
const explicitReviewBranchIndex = client.indexOf('record.status === "review_required"');
assert(amountMismatchBranchIndex >= 0, "Batch normalization must preserve amount_mismatch_skipped as an item-local terminal status.");
assert(explicitReviewBranchIndex > amountMismatchBranchIndex, "Batch normalization must classify amount_mismatch_skipped before the explicit batch-stopping review_required status.");
assert(client.includes('status: "amount_mismatch_skipped", reviewRequired: true, amountCheck: record.amountCheck'), "Amount mismatch must retain its review metadata and amount evidence without becoming review_required.");
assert.equal(client.includes('record.status === "review_required" || record.reviewRequired === true'), false, "reviewRequired metadata must never be promoted into the batch-stopping review_required status.");
assert(client.includes('record.status === "review_required"') && client.includes('status: "review_required", reviewRequired: true'), "Batch result normalization must preserve an explicit review_required status as a distinct stop signal.");
assert(client.includes("shouldStopAmazonInvoiceLocalQueue"), "Batch local queue must centralize its bounded stop decision for executable regression testing.");
assert(client.includes('amount_mismatch_skipped: "failed"'), "Amount mismatch must increment the visible failed/review counter while the queue continues.");
assert(client.includes('item.status === "amount_mismatch_skipped" || item.status === "failed"'), "A batch containing amount mismatch must complete with errors after later queued orders run.");
assert(client.includes("Local file queue stopped on the current review-required order; queued orders were not started."), "Batch must explain that review_required retains the remaining queue instead of advancing.");
assert(client.includes("startButton.disabled = true") && client.includes("startButton.disabled = false"), "Batch Start must be disabled for the full in-flight interval and restored in finally.");
assert(client.includes("amazonInvoiceBatchSellerCentralEntryUrl"), "Local queue must derive Seller Central order detail URL per marketplace/order.");
assert(client.includes("/api/plugins/amazon-invoice-upload/start"), "Local queue must reuse the existing single-upload API.");
assert(client.includes("/api/plugins/amazon-invoice-upload/ledger"), "Local queue must reuse the existing upload ledger route for resume/skip.");
assert(client.includes('body.append("invoicePdf"'), "Local queue must send one PDF per single-upload request.");
assert.equal(client.includes('body.append("invoicePdfs"'), false, "Local queue must not send all PDFs in one multipart request.");
assert.equal(client.includes("requireHumanFinalSubmit"), false, "Local queue must not send human final-submit mode.");
assert.equal(client.includes("stopOnManualRequired"), false, "Local queue must not send manual stop mode.");

const generatedClient = renderAmazonInvoiceClient({
  downloadArtifact: "/download/artifact/",
  downloadLatest: "/download/latest",
  downloadStart: "/download/start",
  uploadLedger: "/upload/ledger",
});
const clientRuntime = {} as {
  normalizeResult?: (result: unknown) => { status?: string; reviewRequired?: boolean; amountCheck?: unknown };
  shouldStop?: (result: { status: string }, stopOnFailed: boolean) => boolean;
  sampleDelay?: () => number;
  crypto?: { getRandomValues: (values: Uint32Array) => Uint32Array };
};
let sampleEntropy = 0;
clientRuntime.crypto = { getRandomValues: (values) => { values[0] = sampleEntropy; return values; } };
runInNewContext(`${generatedClient}\n;globalThis.normalizeResult = normalizeAmazonInvoiceLocalBatchResult; globalThis.shouldStop = shouldStopAmazonInvoiceLocalQueue; globalThis.sampleDelay = sampleAmazonInvoiceInterItemDelayMs;`, clientRuntime);
const normalizedAmountMismatch = clientRuntime.normalizeResult?.({
  record: {
    status: "amount_mismatch_skipped",
    reviewRequired: true,
    reason: "amount mismatch",
    reachedStep: "verify invoice amount against order total",
    amountCheck: { status: "mismatch" },
  },
});
assert.equal(normalizedAmountMismatch?.status, "amount_mismatch_skipped", "Executable client normalization must retain the item-local amount mismatch status.");
assert.equal(normalizedAmountMismatch?.reviewRequired, true, "Executable client normalization must retain review metadata for the mismatched item.");
assert.deepEqual(normalizedAmountMismatch?.amountCheck, { status: "mismatch" }, "Executable client normalization must retain amount evidence.");
assert.equal(clientRuntime.shouldStop?.({ status: "amount_mismatch_skipped" }, false), false, "Amount mismatch must continue to the next queued order by default.");
assert.equal(clientRuntime.shouldStop?.({ status: "amount_mismatch_skipped" }, true), false, "Amount mismatch is a governed item skip and must continue even when stop-on-failed is selected.");
assert.equal(clientRuntime.shouldStop?.({ status: "review_required" }, false), true, "Explicit review_required must stop the batch.");
assert.equal(clientRuntime.shouldStop?.({ status: "blocked_auth" }, false), true, "Authentication blockers must stop the batch.");
assert.equal(clientRuntime.shouldStop?.({ status: "failed" }, false), false, "Ordinary item failure must continue when stop-on-failed is clear.");
assert.equal(clientRuntime.shouldStop?.({ status: "failed" }, true), true, "Ordinary item failure must honor explicit stop-on-failed.");
sampleEntropy = 0;
assert.equal(clientRuntime.sampleDelay?.(), 2000, "Zero entropy must map exactly to the governed 2-second lower bound.");
sampleEntropy = 0xffffffff;
assert.equal(clientRuntime.sampleDelay?.(), 15000, "Maximum uint32 entropy must map exactly to the governed 15-second upper bound.");
const mismatchQueue = await runTwoItemGeneratedQueue("amount_mismatch_skipped", true);
assert.equal(mismatchQueue.startCalls, 2, "A real two-item generated queue must start the second order after amount mismatch, even with stop-on-failed selected.");
assert.deepEqual(mismatchQueue.delayCalls, [2000], "An amount-mismatch item must pace exactly once before the next real request.");
const successQueue = await runTwoItemGeneratedQueue("upload_success", false);
assert.equal(successQueue.startCalls, 2, "Two successful queued orders must both use the existing single-upload API.");
assert.deepEqual(successQueue.delayCalls, [2000], "Two consecutive real requests must have exactly one bounded delay between them.");
const reviewQueue = await runTwoItemGeneratedQueue("review_required", false);
assert.equal(reviewQueue.startCalls, 1, "A real two-item generated queue must stop after an explicit review_required result.");
assert.deepEqual(reviewQueue.delayCalls, [], "Review-required must stop without scheduling a next-item delay.");
const authQueue = await runTwoItemGeneratedQueue("login_required", false);
assert.equal(authQueue.startCalls, 1, "A real two-item generated queue must stop after an authentication blocker.");
assert.deepEqual(authQueue.delayCalls, [], "Authentication blockers must stop without scheduling a next-item delay.");
const transportUnknownQueue = await runTwoItemGeneratedQueue("transport_error", false);
assert.equal(transportUnknownQueue.startCalls, 1, "An unknown transport outcome must not start the next order.");
assert.deepEqual(transportUnknownQueue.delayCalls, [], "An unknown transport outcome must stop without scheduling a next-item delay.");
const continueFailedQueue = await runTwoItemGeneratedQueue("failed", false);
assert.equal(continueFailedQueue.startCalls, 2, "An ordinary failed item may continue only when stop-on-failed is clear.");
assert.deepEqual(continueFailedQueue.delayCalls, [2000], "A governed ordinary failure must still pace before the next real request.");
const stopFailedQueue = await runTwoItemGeneratedQueue("failed", true);
assert.equal(stopFailedQueue.startCalls, 1, "An ordinary failed item must stop when stop-on-failed is selected.");
assert.deepEqual(stopFailedQueue.delayCalls, [], "A stop-on-failed terminal must not schedule a next-item delay.");
const skipBetweenQueue = await runTwoItemGeneratedQueue("upload_success", false, {
  fileNames: ["111-1111111-1111111.pdf", "222-2222222-2222222.pdf", "333-3333333-3333333.pdf"],
  ledgerOrderIds: ["222-2222222-2222222"],
});
assert.equal(skipBetweenQueue.startCalls, 2, "A ledger-only middle item must be skipped without issuing a single-upload request.");
assert.deepEqual(skipBetweenQueue.delayCalls, [2000], "A ledger skip must not consume the delay pending between two real requests.");
const leadingSkipQueue = await runTwoItemGeneratedQueue("upload_success", false, {
  ledgerOrderIds: ["111-1111111-1111111"],
});
assert.equal(leadingSkipQueue.startCalls, 1, "A leading ledger-proven item must be skipped before the first real request.");
assert.deepEqual(leadingSkipQueue.delayCalls, [], "A leading ledger skip must not create a delay before the first real request.");

assert(routes.includes("x-grasseye-source-system"), "Upload route must preserve API source metadata from headers.");
assert(routes.includes("x-grasseye-request-id"), "Upload route must preserve API request metadata from headers.");
assert(missionSchema.includes("sourceSystem: z.string().min(1).optional()"), "Upload mission schema must accept sourceSystem metadata.");
assert(missionSchema.includes("requestId: z.string().min(1).optional()"), "Upload mission schema must accept requestId metadata.");
assert.equal(taskService.includes("returnApiUploadFocusToAdmin"), false, "Terminal upload must preserve operator focus and perform no website-return action.");
assert.equal(taskService.includes("focus-existing-same-path-url"), false, "Same-path focus fallback must remain deleted.");
assert.equal(taskService.includes("focusOnlyExistingTab"), false, "Focus-only compatibility mode must remain deleted.");
assert(taskService.includes("withAmazonInvoiceExecutionLease"), "Direct, start, and resume upload entrypoints must share the plugin-owned execution lease.");
assert(taskService.includes("setExecutionAbortSignal"), "The upload lease must propagate one AbortSignal into the BrowserTargetSession.");
const terminalGuardSource = taskService.slice(taskService.indexOf("async function runAmazonInvoiceUploadWithTerminalGuard"), taskService.indexOf("async function withAmazonInvoiceExecutionLease"));
assert.equal(terminalGuardSource.includes("Promise.race"), false, "Upload terminal timeout must abort and await flow settlement instead of detaching Promise.race.");
assert(terminalGuardSource.includes("abortController.abort") && terminalGuardSource.includes("await runAmazonInvoiceUpload"), "Upload timeout must abort and await the active flow before terminal persistence.");
assert.equal(taskService.includes("Promise.race"), false, "No upload-task browser action may outlive the execution lease through detached Promise.race.");
assert.equal(taskService.includes('reusePolicy: "open-new-tab"'), false, "Website return must not open a new admin tab.");
assert.equal(browserController.includes("focus-existing-same-path-url"), false, "Browser contract must not expose same-path focus fallback.");
assert(exactTargetRuntime.includes("BrowserTargetRegistry"), "Invoice browser actions must use the exact-target runtime.");
assert.equal(exactTargetRuntime.includes("activateChrome"), false, "Ordinary exact-target actions must not activate Chrome.");
assert.equal(
  read("src/lib/browser/current-chrome-browser-controller-runtime.ts").includes("no existing Chrome tab matched ${input.url}"),
  false,
  "Focus-only missing-tab failure must not leak the full admin URL into runtime messages.",
);

async function runTwoItemGeneratedQueue(
  firstStatus: "upload_success" | "amount_mismatch_skipped" | "review_required" | "login_required" | "failed" | "transport_error",
  stopOnFailed: boolean,
  options: { fileNames?: string[]; ledgerOrderIds?: string[] } = {},
): Promise<{ startCalls: number; requestUrls: string[]; delayCalls: number[] }> {
  let startCalls = 0;
  const requestUrls: string[] = [];
  const delayCalls: number[] = [];
  const element = () => ({
    innerHTML: "",
    disabled: false,
    append: (..._items: unknown[]) => undefined,
    addEventListener: (..._items: unknown[]) => undefined,
  });
  const runtime = {
    state: { amazonInvoiceBatchRunning: false, amazonInvoiceBatchId: "" },
    FormData: class {
      append(..._items: unknown[]): void {}
    },
    document: { createElement: element },
    qs: (_selector: string) => element(),
    setText: (..._items: unknown[]) => undefined,
    renderLedger: (..._items: unknown[]) => undefined,
    writeActivity: (..._items: unknown[]) => undefined,
    showWorkspacePage: (..._items: unknown[]) => undefined,
    openInspector: (..._items: unknown[]) => undefined,
    crypto: { getRandomValues: (values: Uint32Array) => { values[0] = 0; return values; } },
    setTimeout: (callback: () => void, delayMs: number) => { delayCalls.push(delayMs); callback(); return 1; },
    readJson: async (url: string) => {
      requestUrls.push(url);
      if (url === "/api/health") return { status: "healthy" };
      if (url === "/upload/ledger" || url === "/api/plugins/amazon-invoice-upload/ledger") return {
        records: (options.ledgerOrderIds || []).map((amazonOrderId) => ({ amazonOrderId, invoiceNo: amazonOrderId, status: "upload_success", taskId: "ledger-task" })),
      };
      if (url === "/api/plugins/amazon-invoice-upload/start") {
        startCalls += 1;
        const status = startCalls === 1 ? firstStatus : "upload_success";
        if (status === "transport_error") throw new Error("connection closed after request send");
        return {
          record: {
            status,
            reviewRequired: status === "amount_mismatch_skipped" || status === "review_required",
            reason: status,
            reachedStep: status,
            amountCheck: status === "amount_mismatch_skipped" ? { status: "mismatch" } : undefined,
          },
        };
      }
      throw new Error(`Unexpected generated-client request: ${url}`);
    },
  } as Record<string, unknown>;
  const startBatch = runInNewContext(`${generatedClient}\n;startAmazonInvoiceBatch;`, runtime) as (event: unknown) => Promise<void>;
  const startButton = { disabled: false };
  const form = {
    marketplace: { value: "AE" },
    invoicePdfs: { files: (options.fileNames || ["111-1111111-1111111.pdf", "222-2222222-2222222.pdf"]).map((name) => ({ name })) },
    stopOnFailed: { checked: stopOnFailed },
    querySelector: (_selector: string) => startButton,
  };
  await startBatch({ preventDefault: () => undefined, currentTarget: form });
  assert.equal(startButton.disabled, false, "Generated queue must release its start latch after the terminal batch state.");
  if (startCalls === 0) throw new Error(`Generated queue did not reach single-upload requests; requests=${JSON.stringify(requestUrls)}`);
  return { startCalls, requestUrls, delayCalls };
}

assert(homeClient.includes("startAmazonInvoiceBatch"), "Home client must bind the batch form to the local queue runner.");
assert(homeClient.includes("refreshAmazonInvoiceUploadLedger"), "Home client must bind persisted upload ledger refresh.");
assert(homeClient.includes("/api/plugins/amazon-invoice-upload/ledger"), "Home client must call the upload ledger route.");

process.stdout.write("[ACCEPTANCE] amazon-invoice-upload-batch PASS\n");
