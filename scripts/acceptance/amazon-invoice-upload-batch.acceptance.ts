import { strict as assert } from "node:assert";
import { mkdtempSync } from "node:fs";
import { IncomingMessage } from "node:http";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildAmazonInvoiceUploadBatchItems,
  buildReceivedBatchRecord,
  listBatchRecords,
  loadBatchRecord,
  parseAmazonInvoiceUploadBatchFilename,
  saveBatchRecord,
  updateBatchItem,
} from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch-storage.js";
import { AmazonInvoiceUploadBatchMissionInputSchema } from "../../src/plugins/amazon-invoice-upload/mission.schema.js";
import type { AmazonInvoiceUploadBatchPdfFile } from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-batch.types.js";
import { readMultipartFormData } from "../../src/app/workbench-multipart.js";

const validMission = {
  missionType: "amazon_invoice_upload_batch",
  marketplace: "AE",
  sellerCentralEntryUrl: "https://sellercentral.amazon.ae/home",
  sourceKind: "filename_order_id",
  sourceSystem: "ontheway",
  requestId: "batch-acceptance-1",
} as const;

const pdfFile = (filename: string): AmazonInvoiceUploadBatchPdfFile => ({
  filename,
  mimeType: "application/pdf",
  bytes: Buffer.from("%PDF-1.4\n"),
});

const assertSchema = (): void => {
  const parsed = AmazonInvoiceUploadBatchMissionInputSchema.parse(validMission);
  assert.equal(parsed.mode, "batch_upload");
  for (const forbidden of ["selector", "cookie", "browserCommand", "flowStep", "documentId", "requireHumanFinalSubmit", "stopOnManualRequired"]) {
    assert.equal(
      AmazonInvoiceUploadBatchMissionInputSchema.safeParse({ ...validMission, [forbidden]: "blocked" }).success,
      false,
      `batch mission schema must reject ${forbidden}`,
    );
  }
};

const assertFileValidation = (): void => {
  const parsed = parseAmazonInvoiceUploadBatchFilename("403-7307700-7597913.pdf");
  assert.equal(parsed?.amazonOrderId, "403-7307700-7597913");
  assert.equal(parsed?.invoiceNo, "403-7307700-7597913");
  assert.equal(buildAmazonInvoiceUploadBatchItems([pdfFile("invoice.pdf")]).reason, "invalid_pdf_filename");
  assert.equal(buildAmazonInvoiceUploadBatchItems([{ ...pdfFile("403-7307700-7597913.pdf"), mimeType: "image/jpeg" }]).reason, "invalid_pdf_mime_type");
  assert.equal(buildAmazonInvoiceUploadBatchItems([pdfFile("403-7307700-7597913.pdf"), pdfFile("403-7307700-7597913.pdf")]).reason, "duplicate_order_id");
  const largeBatch = buildAmazonInvoiceUploadBatchItems(Array.from({ length: 2000 }, (_, index) => pdfFile(`403-${String(7300000 + index)}-${String(index).padStart(7, "0")}.pdf`)));
  assert.equal(largeBatch.ok, true);
  assert.equal(largeBatch.items.length, 2000);
};

const assertStorageAndCounters = (): void => {
  const dataDir = mkdtempSync(join(tmpdir(), "grasseye-amazon-invoice-batch-"));
  const mission = AmazonInvoiceUploadBatchMissionInputSchema.parse(validMission);
  const firstItems = buildAmazonInvoiceUploadBatchItems([pdfFile("403-7307700-7597913.pdf")]).items;
  const older = buildReceivedBatchRecord({ batchId: "batch_older", mission, items: firstItems });
  saveBatchRecord(dataDir, older);
  const newer = updateBatchItem(
    buildReceivedBatchRecord({ batchId: "batch_newer", mission, items: firstItems }),
    0,
    { status: "upload_success", reason: "done", reachedStep: "upload success verified" },
  );
  saveBatchRecord(dataDir, newer);
  assert.equal(loadBatchRecord(dataDir, "batch_newer")?.succeeded, 1);
  assert.equal(listBatchRecords(dataDir, { limit: 2 })[0]?.batchId, "batch_newer");
  assert.equal(listBatchRecords(dataDir, { orderId: "403-7307700-7597913" }).length, 2);
  const serialized = JSON.stringify(newer);
  assert.equal(serialized.includes("%PDF"), false, "batch record must not include PDF bytes");
  assert.equal(serialized.includes(dataDir), false, "batch record must not include local absolute paths");
  assert.equal(serialized.includes("cookie"), false, "batch record must not include cookies");
  assert.equal(serialized.includes("documentId"), false, "batch record must not include documentId");
};

const assertMultipartFileLists = async (): Promise<void> => {
  const boundary = "batch-boundary";
  const body = [
    part(boundary, 'form-data; name="mission"', JSON.stringify(validMission)),
    part(boundary, 'form-data; name="invoicePdf"; filename="403-7307700-7597913.pdf"', "%PDF-single\n", "application/pdf"),
    part(boundary, 'form-data; name="invoicePdfs"; filename="403-7307700-7597913.pdf"', "%PDF-a\n", "application/pdf"),
    part(boundary, 'form-data; name="invoicePdfs"; filename="403-7307700-7597914.pdf"', "%PDF-b\n", "application/pdf"),
    `--${boundary}--\r\n`,
  ].join("");
  const request = new IncomingMessage(new Socket());
  request.headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
  request.push(Buffer.from(body, "utf8"));
  request.push(null);
  const form = await readMultipartFormData(request);
  assert.equal(form.files.get("invoicePdf")?.filename, "403-7307700-7597913.pdf");
  assert.equal(form.fileLists.get("invoicePdfs")?.length, 2);
};

function part(boundary: string, disposition: string, body: string, mimeType?: string): string {
  return [
    `--${boundary}`,
    `Content-Disposition: ${disposition}`,
    ...(mimeType ? [`Content-Type: ${mimeType}`] : []),
    "",
    body,
  ].join("\r\n") + "\r\n";
}

assertSchema();
assertFileValidation();
assertStorageAndCounters();
await assertMultipartFileLists();

process.stdout.write("[ACCEPTANCE] amazon-invoice-upload-batch PASS\n");
