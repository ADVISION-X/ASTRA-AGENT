import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildDownloadArtifactMetadata,
  buildReceivedDownloadTaskRecord,
  createAmazonTaxInvoiceDownloadTaskId,
  loadDownloadTaskRecord,
  saveDownloadTaskRecord,
  updateDownloadTaskRecord,
} from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.js";
import { AmazonTaxInvoiceDownloadMissionInputSchema } from "../../src/plugins/amazon-invoice-upload/mission.schema.js";

const validMission = {
  missionType: "amazon_tax_invoice_download",
  marketplace: "AE",
  sellerCentralEntryUrl: "https://sellercentral.amazon.ae/home",
  reportKind: "afn_shipment_invoicing_tax_invoice",
  dateRange: "last_30_days",
  format: "csv",
  sourceSystem: "ontheway",
  requestId: "download-acceptance-1",
  requireHumanReview: true,
} as const;

const assertSchema = (): void => {
  const parsed = AmazonTaxInvoiceDownloadMissionInputSchema.parse(validMission);
  assert.equal(parsed.mode, "download_only");
  assert.equal(parsed.reportKind, "afn_shipment_invoicing_tax_invoice");
  for (const forbidden of ["selector", "documentId", "downloadUrl", "browserCommand", "cookie"]) {
    assert.equal(
      AmazonTaxInvoiceDownloadMissionInputSchema.safeParse({ ...validMission, [forbidden]: "blocked" }).success,
      false,
      `download mission schema must reject ${forbidden}`,
    );
  }
};

const assertStorageAndArtifactSafety = (): void => {
  const dataDir = mkdtempSync(join(tmpdir(), "grasseye-amazon-invoice-download-"));
  const taskId = createAmazonTaxInvoiceDownloadTaskId();
  const received = buildReceivedDownloadTaskRecord({ taskId, mission: AmazonTaxInvoiceDownloadMissionInputSchema.parse(validMission) });
  saveDownloadTaskRecord(dataDir, received);
  assert.equal(loadDownloadTaskRecord(dataDir, taskId)?.taskKind, "tax_invoice_download");

  const csvPath = join(dataDir, "tax-invoice.csv");
  writeFileSync(csvPath, "private,csv,content\n");
  const artifact = buildDownloadArtifactMetadata(csvPath);
  const completed = updateDownloadTaskRecord(received, {
    ok: true,
    status: "completed",
    reason: "acceptance completed",
    reachedStep: "verify local download artifact",
    evidenceStepId: "AID-11",
    downloadArtifactRef: artifact.artifactRef,
    downloadedFileName: artifact.artifactName,
    downloadedFileSize: artifact.fileSize,
    downloadedFileSha256: artifact.sha256,
    downloadedAt: artifact.createdAt,
  });
  saveDownloadTaskRecord(dataDir, completed);
  const loaded = loadDownloadTaskRecord(dataDir, taskId);
  assert.equal(loaded?.artifact?.artifactName, "tax-invoice.csv");
  assert.equal(loaded?.artifact?.mimeType, "text/csv");
  assert.equal("path" in (loaded?.artifact ?? {}), false, "artifact metadata must not expose local absolute path");
  assert.equal(JSON.stringify(loaded).includes("private,csv,content"), false, "task record must not persist raw CSV content");
};

assertSchema();
assertStorageAndArtifactSafety();

process.stdout.write("[ACCEPTANCE] amazon-invoice-upload-download PASS\n");
