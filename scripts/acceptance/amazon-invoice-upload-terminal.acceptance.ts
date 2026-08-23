import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  getAmazonInvoiceUploadTaskStatus,
  getAmazonTaxInvoiceDownloadArtifact,
  startAmazonInvoiceUploadTask,
  startAmazonTaxInvoiceDownloadTask,
} from "../../src/plugins/amazon-invoice-upload/index.js";

const dataDir = mkdtempSync(join(tmpdir(), "grasseye-invoice-terminal-"));
const upload = await startAmazonInvoiceUploadTask({
  dataDir,
  task: {
    mission: {
      missionType: "amazon_invoice_upload",
      marketplace: "AE",
      amazonOrderId: "000-0000000-0000000",
      invoiceNo: "INV-TERMINAL-1",
      invoicePdfPath: "approved-by-workbench",
      sellerCentralEntryUrl: "https://sellercentral.amazon.ae/orders-v3/order/000-0000000-0000000",
    },
    invoicePdf: { approved: true },
  },
});

assert.equal(upload.status, "review_required");
assert.equal(upload.reason, "BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED");
assert.equal(upload.reachedStep, "terminal_browser_authority_gate");
assert.equal((await getAmazonInvoiceUploadTaskStatus({ dataDir, taskId: upload.taskId })).taskId, upload.taskId);

const download = await startAmazonTaxInvoiceDownloadTask({
  dataDir,
  mission: {
    missionType: "amazon_tax_invoice_download",
    mode: "download_only",
    marketplace: "AE",
    sellerCentralEntryUrl: "https://sellercentral.amazon.ae/home",
    reportKind: "afn_shipment_invoicing_tax_invoice",
    dateRange: "last_30_days",
    format: "csv",
  },
});
assert.equal(download.status, "manual_required");
assert.equal(download.reason, "BROWSER_AUTHORITY_NOT_PRODUCTION_VERIFIED");
assert.equal(await getAmazonTaxInvoiceDownloadArtifact(download.taskId), null);

process.stdout.write("[ACCEPTANCE] amazon-invoice-upload-terminal PASS\n");
