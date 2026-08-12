import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import type { AmazonInvoiceUploadTaskRecord } from "./amazon-invoice-upload-storage.types.js";

export type AmazonInvoiceUploadLedgerRecord = {
  taskId: string;
  amazonOrderId: string;
  invoiceNo: string;
  status: string;
  reason: string;
  reachedStep: string;
  evidenceRef: string | null;
  runtimeLogRef: string | null;
  navigationEvidenceRef: string | null;
  reviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

const ledgerDbPath = (dataDir: string): string =>
  path.join(dataDir, "plugin-tasks", "amazon-invoice-upload", "amazon_invoice_upload_ledger.sqlite");

const taskRootPath = (dataDir: string): string =>
  path.join(dataDir, "plugin-tasks", "amazon-invoice-upload");

function openLedgerDb(dataDir: string): Database.Database {
  const dbPath = ledgerDbPath(dataDir);
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS amazon_invoice_upload_ledger (
    task_id TEXT PRIMARY KEY,
    amazon_order_id TEXT NOT NULL,
    invoice_no TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    reached_step TEXT NOT NULL,
    evidence_ref TEXT,
    runtime_log_ref TEXT,
    navigation_evidence_ref TEXT,
    review_required INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  ensureLedgerColumn(db, "runtime_log_ref", "TEXT");
  ensureLedgerColumn(db, "navigation_evidence_ref", "TEXT");
  db.exec("CREATE INDEX IF NOT EXISTS idx_amazon_invoice_upload_ledger_order ON amazon_invoice_upload_ledger (amazon_order_id, updated_at)");
  return db;
}

function ensureLedgerColumn(db: Database.Database, name: string, type: "TEXT"): void {
  const columns = db.prepare("PRAGMA table_info(amazon_invoice_upload_ledger)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE amazon_invoice_upload_ledger ADD COLUMN ${name} ${type}`);
  }
}

export function upsertAmazonInvoiceUploadLedgerRecord(dataDir: string, record: AmazonInvoiceUploadTaskRecord): void {
  const db = openLedgerDb(dataDir);
  try {
    writeLedgerRecord(db, record);
  } finally {
    db.close();
  }
}

export function listAmazonInvoiceUploadLedgerRecords(dataDir: string): AmazonInvoiceUploadLedgerRecord[] {
  const db = openLedgerDb(dataDir);
  try {
    backfillLedgerFromTaskRecords(dataDir, db);
    return db.prepare(`WITH ranked_ledger AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY amazon_order_id, invoice_no
          ORDER BY CASE WHEN status IN ('upload_success', 'already_uploaded') THEN 0 ELSE 1 END, updated_at DESC
        ) AS canonical_rank
      FROM amazon_invoice_upload_ledger
    )
    SELECT
      task_id AS taskId,
      amazon_order_id AS amazonOrderId,
      invoice_no AS invoiceNo,
      status,
      reason,
      reached_step AS reachedStep,
      evidence_ref AS evidenceRef,
      runtime_log_ref AS runtimeLogRef,
      navigation_evidence_ref AS navigationEvidenceRef,
      review_required AS reviewRequired,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM ranked_ledger
    WHERE canonical_rank = 1
    ORDER BY updated_at DESC`).all().map((row) => ({
      ...(row as Omit<AmazonInvoiceUploadLedgerRecord, "reviewRequired"> & { reviewRequired: number }),
      reviewRequired: Boolean((row as { reviewRequired: number }).reviewRequired),
    }));
  } finally {
    db.close();
  }
}

function writeLedgerRecord(db: Database.Database, record: AmazonInvoiceUploadTaskRecord): void {
  db.prepare(`INSERT INTO amazon_invoice_upload_ledger (
    task_id, amazon_order_id, invoice_no, status, reason, reached_step,
    evidence_ref, runtime_log_ref, navigation_evidence_ref, review_required, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(task_id) DO UPDATE SET
    amazon_order_id = excluded.amazon_order_id,
    invoice_no = excluded.invoice_no,
    status = excluded.status,
    reason = excluded.reason,
    reached_step = excluded.reached_step,
    evidence_ref = excluded.evidence_ref,
    runtime_log_ref = excluded.runtime_log_ref,
    navigation_evidence_ref = excluded.navigation_evidence_ref,
    review_required = excluded.review_required,
    updated_at = excluded.updated_at`).run(
      record.taskId,
      record.amazonOrderId,
      record.invoiceNo,
      record.status,
      record.reason,
      record.reachedStep,
      record.evidenceRef ?? null,
      record.runtimeLogRef ?? null,
      record.orderNavigationProof?.evidenceRef ?? null,
      record.reviewRequired ? 1 : 0,
      record.createdAt,
      record.updatedAt,
    );
}

function backfillLedgerFromTaskRecords(dataDir: string, db: Database.Database): void {
  const root = taskRootPath(dataDir);
  if (!existsSync(root)) return;
  const writeMany = db.transaction((records: AmazonInvoiceUploadTaskRecord[]) => {
    for (const record of records) {
      writeLedgerRecord(db, record);
    }
  });
  writeMany(readTaskRecords(root));
}

function readTaskRecords(root: string): AmazonInvoiceUploadTaskRecord[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => readTaskRecord(path.join(root, entry.name, "task.json")));
}

function readTaskRecord(recordPath: string): AmazonInvoiceUploadTaskRecord[] {
  if (!existsSync(recordPath)) return [];
  const record = JSON.parse(readFileSync(recordPath, "utf8")) as AmazonInvoiceUploadTaskRecord;
  return record.taskId && record.amazonOrderId && record.invoiceNo ? [record] : [];
}
