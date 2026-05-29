import { mkdirSync } from "node:fs";
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
  domTraceRef: string | null;
  reviewRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

const ledgerDbPath = (dataDir: string): string =>
  path.join(dataDir, "plugin-tasks", "amazon-invoice-upload", "amazon_invoice_upload_ledger.sqlite");

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
    dom_trace_ref TEXT,
    review_required INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_amazon_invoice_upload_ledger_order ON amazon_invoice_upload_ledger (amazon_order_id, updated_at)");
  return db;
}

export function upsertAmazonInvoiceUploadLedgerRecord(dataDir: string, record: AmazonInvoiceUploadTaskRecord): void {
  const db = openLedgerDb(dataDir);
  try {
    db.prepare(`INSERT INTO amazon_invoice_upload_ledger (
      task_id, amazon_order_id, invoice_no, status, reason, reached_step,
      evidence_ref, dom_trace_ref, review_required, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(task_id) DO UPDATE SET
      amazon_order_id = excluded.amazon_order_id,
      invoice_no = excluded.invoice_no,
      status = excluded.status,
      reason = excluded.reason,
      reached_step = excluded.reached_step,
      evidence_ref = excluded.evidence_ref,
      dom_trace_ref = excluded.dom_trace_ref,
      review_required = excluded.review_required,
      updated_at = excluded.updated_at`).run(
        record.taskId,
        record.amazonOrderId,
        record.invoiceNo,
        record.status,
        record.reason,
        record.reachedStep,
        record.evidenceRef ?? null,
        record.domTraceRef ?? null,
        record.reviewRequired ? 1 : 0,
        record.createdAt,
        record.updatedAt,
      );
  } finally {
    db.close();
  }
}

export function listAmazonInvoiceUploadLedgerRecords(dataDir: string): AmazonInvoiceUploadLedgerRecord[] {
  const db = openLedgerDb(dataDir);
  try {
    return db.prepare(`SELECT
      task_id AS taskId,
      amazon_order_id AS amazonOrderId,
      invoice_no AS invoiceNo,
      status,
      reason,
      reached_step AS reachedStep,
      evidence_ref AS evidenceRef,
      dom_trace_ref AS domTraceRef,
      review_required AS reviewRequired,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM amazon_invoice_upload_ledger
    ORDER BY updated_at DESC`).all().map((row) => ({
      ...(row as Omit<AmazonInvoiceUploadLedgerRecord, "reviewRequired"> & { reviewRequired: number }),
      reviewRequired: Boolean((row as { reviewRequired: number }).reviewRequired),
    }));
  } finally {
    db.close();
  }
}
