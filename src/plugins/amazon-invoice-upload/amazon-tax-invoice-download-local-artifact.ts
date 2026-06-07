import { existsSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { RuntimeLogger } from "../../lib/runtime-logs/index.js";
import { recordAmazonDomStepTrace } from "./amazon-dom-step-trace.js";
import { buildDownloadArtifactMetadata } from "./amazon-invoice-upload-storage.js";
import type { AmazonTaxInvoiceDownloadTaskResult } from "./amazon-invoice-upload-storage.types.js";
import type { AmazonTaxInvoiceDownloadMissionInput } from "./mission.schema.js";

const WAIT_DOWNLOAD_FILE_TIMEOUT_MS = 30_000;
const WAIT_DOWNLOAD_FILE_POLL_MS = 1_000;

export type FileCandidate = {
  path: string;
  mtimeMs: number;
  size: number;
};

export const listDownloadFiles = (): FileCandidate[] => {
  const downloadsDir = path.join(os.homedir(), "Downloads");
  if (!existsSync(downloadsDir)) return [];
  return readdirSync(downloadsDir)
    .filter((name) => !name.endsWith(".crdownload") && !name.endsWith(".download"))
    .map((name) => path.join(downloadsDir, name))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => {
      const stats = statSync(filePath);
      return { path: filePath, mtimeMs: stats.mtimeMs, size: stats.size };
    });
};

export const waitForNewDownloadFile = async (baselineFiles: FileCandidate[]): Promise<string | null> => {
  const baseline = new Map(baselineFiles.map((file) => [file.path, `${file.mtimeMs}:${file.size}`]));
  const startedAt = Date.now();
  while (Date.now() - startedAt <= WAIT_DOWNLOAD_FILE_TIMEOUT_MS) {
    const current = listDownloadFiles()
      .filter((file) => file.size > 0)
      .filter((file) => baseline.get(file.path) !== `${file.mtimeMs}:${file.size}`)
      .sort((left, right) => right.mtimeMs - left.mtimeMs);
    if (current[0]) return current[0].path;
    await new Promise((resolve) => setTimeout(resolve, WAIT_DOWNLOAD_FILE_POLL_MS));
  }
  return null;
};

export const verifyLocalDownloadArtifact = (
  runtimeLogger: RuntimeLogger,
  mission: AmazonTaxInvoiceDownloadMissionInput,
  filePath: string,
): AmazonTaxInvoiceDownloadTaskResult => {
  const metadata = buildDownloadArtifactMetadata(filePath);
  recordAmazonDomStepTrace({
    runtimeLogger,
    mission,
    stepName: "AID-11 verify local download artifact",
    status: "success",
    reason: `Downloaded artifact persisted as ${metadata.artifactName}.`,
  });
  return {
    ok: true,
    status: "completed",
    reason: "Amazon tax invoice CSV download completed and safe artifact metadata was persisted.",
    reachedStep: "verify local download artifact",
    evidenceStepId: "AID-11",
    downloadArtifactRef: metadata.artifactRef,
    downloadedFileName: metadata.artifactName,
    downloadedFileSize: metadata.fileSize,
    downloadedFileSha256: metadata.sha256,
    downloadedAt: metadata.createdAt,
    domTraceRef: "runtime-evidence/amazon-invoice-upload/download.jsonl",
  };
};
