import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
assert(client.includes("amazonInvoiceBatchSellerCentralEntryUrl"), "Local queue must derive Seller Central order detail URL per marketplace/order.");
assert(client.includes("/api/plugins/amazon-invoice-upload/start"), "Local queue must reuse the existing single-upload API.");
assert(client.includes("/api/plugins/amazon-invoice-upload/ledger"), "Local queue must reuse the existing upload ledger route for resume/skip.");
assert(client.includes('body.append("invoicePdf"'), "Local queue must send one PDF per single-upload request.");
assert.equal(client.includes('body.append("invoicePdfs"'), false, "Local queue must not send all PDFs in one multipart request.");
assert.equal(client.includes("requireHumanFinalSubmit"), false, "Local queue must not send human final-submit mode.");
assert.equal(client.includes("stopOnManualRequired"), false, "Local queue must not send manual stop mode.");

assert(homeClient.includes("startAmazonInvoiceBatch"), "Home client must bind the batch form to the local queue runner.");
assert(homeClient.includes("refreshAmazonInvoiceUploadLedger"), "Home client must bind persisted upload ledger refresh.");
assert(homeClient.includes("/api/plugins/amazon-invoice-upload/ledger"), "Home client must call the upload ledger route.");

process.stdout.write("[ACCEPTANCE] amazon-invoice-upload-batch PASS\n");
