import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  ProductVideoNavigationEntrySchema,
  ProductVideoEvidenceRecordSchema,
  type ProductVideoNavigationEntry,
  type ProductVideoEvidenceRecord,
} from "./product-video-dom.schema.js";

type ProductVideoRecordsIndex = {
  schemaVersion: "productVideoDom.records.index.v1";
  totalRecords: number;
  totalBrowseEntries: number;
  latestRecordId: string | null;
  latestCapturedAt: string | null;
  updatedAt: string;
};

type ProductVideoStorePaths = {
  runtimeDataDir: string;
  recordsJsonlPath: string;
  recordsIndexPath: string;
  browseLedgerJsonlPath: string;
};

const INDEX_SCHEMA_VERSION = "productVideoDom.records.index.v1" as const;

const buildStorePaths = (dataDir: string): ProductVideoStorePaths => {
  const runtimeDataDir = path.join(dataDir, "runtime-data");
  return {
    runtimeDataDir,
    recordsJsonlPath: path.join(runtimeDataDir, "product-video-dom-records.jsonl"),
    recordsIndexPath: path.join(runtimeDataDir, "product-video-dom-records.index.json"),
    browseLedgerJsonlPath: path.join(runtimeDataDir, "product-video-dom-browse-ledger.jsonl"),
  };
};

const ensureRuntimeDataDir = (paths: ProductVideoStorePaths): void => {
  mkdirSync(paths.runtimeDataDir, { recursive: true });
};

const readJsonlLines = (filePath: string): string[] => {
  if (!existsSync(filePath)) {
    return [];
  }
  return readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
};

const writeIndexFile = (
  indexPath: string,
  index: ProductVideoRecordsIndex,
): void => {
  writeFileSync(indexPath, JSON.stringify(index, null, 2));
};

const readIndexFile = (indexPath: string): ProductVideoRecordsIndex => {
  if (!existsSync(indexPath)) {
    return {
      schemaVersion: INDEX_SCHEMA_VERSION,
      totalRecords: 0,
      totalBrowseEntries: 0,
      latestRecordId: null,
      latestCapturedAt: null,
      updatedAt: new Date(0).toISOString(),
    };
  }
  const parsed = JSON.parse(readFileSync(indexPath, "utf8")) as Partial<ProductVideoRecordsIndex>;
  return {
    schemaVersion: INDEX_SCHEMA_VERSION,
    totalRecords: typeof parsed.totalRecords === "number" ? parsed.totalRecords : 0,
    totalBrowseEntries: typeof parsed.totalBrowseEntries === "number" ? parsed.totalBrowseEntries : 0,
    latestRecordId: typeof parsed.latestRecordId === "string" ? parsed.latestRecordId : null,
    latestCapturedAt: typeof parsed.latestCapturedAt === "string" ? parsed.latestCapturedAt : null,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date(0).toISOString(),
  };
};

const appendJsonlLine = (filePath: string, payload: unknown): void => {
  writeFileSync(filePath, `${JSON.stringify(payload)}\n`, { flag: "a" });
};

const parseValidatedJsonLine = <TValue>(
  line: string,
  validate: (value: unknown) => TValue,
): TValue => validate(JSON.parse(line));

export const getProductVideoStorePaths = (dataDir: string): ProductVideoStorePaths => buildStorePaths(dataDir);

export const appendProductVideoEvidenceRecord = (input: {
  dataDir: string;
  record: ProductVideoEvidenceRecord;
}): ProductVideoEvidenceRecord => {
  const paths = buildStorePaths(input.dataDir);
  ensureRuntimeDataDir(paths);
  const record = ProductVideoEvidenceRecordSchema.parse(input.record);
  appendJsonlLine(paths.recordsJsonlPath, record);
  const nextIndex: ProductVideoRecordsIndex = {
    ...readIndexFile(paths.recordsIndexPath),
    schemaVersion: INDEX_SCHEMA_VERSION,
    totalRecords: readJsonlLines(paths.recordsJsonlPath).length,
    latestRecordId: record.id,
    latestCapturedAt: record.capturedAt,
    updatedAt: new Date().toISOString(),
  };
  writeIndexFile(paths.recordsIndexPath, nextIndex);
  return record;
};

export const listProductVideoEvidenceRecords = (input: {
  dataDir: string;
  limit?: number;
}): ProductVideoEvidenceRecord[] => {
  const paths = buildStorePaths(input.dataDir);
  const lines = readJsonlLines(paths.recordsJsonlPath);
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));
  return lines
    .slice(-limit)
    .reverse()
    .map((line) => parseValidatedJsonLine(line, (value) => ProductVideoEvidenceRecordSchema.parse(value)));
};

export const appendProductVideoNavigationEntry = (input: {
  dataDir: string;
  entry: ProductVideoNavigationEntry;
}): ProductVideoNavigationEntry => {
  const paths = buildStorePaths(input.dataDir);
  ensureRuntimeDataDir(paths);
  const entry = ProductVideoNavigationEntrySchema.parse(input.entry);
  appendJsonlLine(paths.browseLedgerJsonlPath, entry);
  const currentIndex = readIndexFile(paths.recordsIndexPath);
  writeIndexFile(paths.recordsIndexPath, {
    ...currentIndex,
    schemaVersion: INDEX_SCHEMA_VERSION,
    totalBrowseEntries: readJsonlLines(paths.browseLedgerJsonlPath).length,
    updatedAt: new Date().toISOString(),
  });
  return entry;
};