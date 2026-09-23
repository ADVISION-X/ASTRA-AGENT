import { executionFailure, typedExecutionFailure } from "../../execution-failure.js";
import {
  hashCanonical,
  parseTerminalReceipt,
  parseTerminalReceiptExpectation,
  type ProductionHash,
} from "./contracts.js";
import { ProductionStoreOutbox } from "./store-outbox.js";
import {
  resolveProductionAuthority,
  stateInvariantFailureCount,
  type ProductionOutboxWrite,
  type StoredProductionTask,
} from "./store-foundation.js";
import type { ProductionRuntimeStorageResponsibilities } from "./runtime-storage-inventory.js";

type LedgerRow = Readonly<{
  kind: ProductionOutboxWrite["kind"];
  path: string;
  body_blob: Buffer;
  response_json: string | null;
  receipt_hash: ProductionHash | null;
}>;

type LedgerProjection = {
  terminalByJob: Map<string, Record<string, unknown>>;
  artifactReceiptsByJob: Map<string, ProductionHash[]>;
};

const registerArtifact = (projection: LedgerProjection, row: LedgerRow, jobId: string): boolean => {
  if (!row.receipt_hash) return false;
  projection.artifactReceiptsByJob.set(jobId, [
    ...(projection.artifactReceiptsByJob.get(jobId) ?? []), row.receipt_hash,
  ]);
  return true;
};

const registerTerminal = (
  projection: LedgerProjection,
  row: LedgerRow,
  jobId: string,
): boolean => {
  try {
    const terminal = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>;
    if (terminal.terminal_status !== "completed") return false;
    const expected = parseTerminalReceiptExpectation(terminal);
    if (expected.job_id !== jobId) return false;
    if (row.response_json) parseTerminalReceipt(JSON.parse(row.response_json) as unknown, expected);
    projection.terminalByJob.set(jobId, terminal);
    return true;
  } catch { return false; }
};

const completionPayloadConsistent = (
  task: StoredProductionTask,
  terminal: Record<string, unknown>,
  projection: LedgerProjection,
): boolean => {
  const jobId = task.task.job_id;
  const result = task.status === "completed" ? task.result : task.staged_result;
  if (!result || terminal.payload_hash !== hashCanonical(result)
    || result.evidence_refs.length === 0) return false;
  const terminalReceipts = terminal.result_object_receipts;
  return Array.isArray(terminalReceipts)
    && terminalReceipts.length >= 2 && terminalReceipts.length <= 4
    && terminalReceipts.every((receipt) => typeof receipt === "string")
    && new Set(terminalReceipts).size === terminalReceipts.length
    && terminalReceipts.every((receipt) =>
      (projection.artifactReceiptsByJob.get(jobId) ?? []).includes(receipt as ProductionHash));
};

export class ProductionRuntimeStore extends ProductionStoreOutbox {
  public resolveAuthority(
    authorityRef: string,
    authorityHash: ProductionHash,
  ): "verified" | "missing" | "mismatch" {
    return resolveProductionAuthority(this, authorityRef, authorityHash);
  }

  public pendingOutboxCount(): number {
    return Number((this.database.prepare(
      `select count(*) as count from production_outbox where sent_at is null
        and (last_error is null or (kind='provider_cooldown'
          and last_error<>'BUSINESS_ADMITTED'))`,
    ).get() as { count: number }).count);
  }

  public assertStartupDataIntegrity(): void {
    let code = "PRODUCTION_TASK_AUTHORITY_CORRUPT";
    try {
      this.taskAuthorities();
      code = "PRODUCTION_STATE_INVARIANT_INVALID";
      if (stateInvariantFailureCount(this.database) !== 0) throw executionFailure("failed", code);
      code = "PRODUCTION_LEDGER_INVARIANT_INVALID";
      if (!this.isLedgerConsistent(new Set())) throw executionFailure("failed", code);
    } catch (cause) {
      throw typedExecutionFailure(cause) ?? executionFailure("failed", code, { cause });
    }
  }

  public storageResponsibilities(): ProductionRuntimeStorageResponsibilities {
    const count = (sql: string): number => Number((this.database.prepare(sql).get() as { count: number }).count);
    return Object.freeze({
      task_ids: Object.freeze(this.taskAuthorities().map((record) => record.task.job_id)),
      outbox_responsibility_count: count("select count(*) as count from production_outbox"),
      pending_outbox_count: count("select count(*) as count from production_outbox where sent_at is null"),
    });
  }

  private buildLedgerProjection(): LedgerProjection | null {
    const rows = this.database.prepare(`select kind,path,body_blob,response_json,receipt_hash
      from production_outbox
      where (kind='terminal' or (sent_at is not null and response_hash is not null))
      order by created_at,idempotency_key`).all() as LedgerRow[];
    const projection: LedgerProjection = {
      terminalByJob: new Map(), artifactReceiptsByJob: new Map(),
    };
    for (const row of rows) {
      const match = /\/jobs\/([^/]+)\//u.exec(row.path);
      if (!match?.[1]) return null;
      const jobId = decodeURIComponent(match[1]);
      if (row.kind === "artifact" && !registerArtifact(projection, row, jobId)) return null;
      if (row.kind === "terminal" && !registerTerminal(projection, row, jobId)) return null;
    }
    return projection;
  }

  private terminalTaskConsistent(
    task: StoredProductionTask,
    terminal: Record<string, unknown> | undefined,
  ): boolean {
    const isTerminal = task.status === "completed";
    const admissionPending = task.status === "failed" && task.staged_result !== null;
    if (admissionPending) return Boolean(terminal && terminal.terminal_status === "completed");
    if (!isTerminal) return true;
    return isTerminal === Boolean(terminal)
      && (!terminal || terminal.terminal_status === "completed");
  }

  public isLedgerConsistent(_activeJobIds: ReadonlySet<string>): boolean {
    const tasks = new Map(this.taskAuthorities().map((record) => [record.task.job_id, record] as const));
    const outbox = this.outboxAuthorities();
    if (outbox.some((authority) => authority.state === "delivered"
      && (!authority.responseHash || (authority.kind === "artifact" && !authority.receiptHash)))) return false;
    if (outbox.some((authority) => !tasks.has(authority.jobId))) return false;
    const projection = this.buildLedgerProjection();
    if (!projection) return false;
    for (const [jobId, task] of tasks) {
      const terminal = projection.terminalByJob.get(jobId);
      const jobOutbox = outbox.filter((authority) => authority.jobId === jobId);
      if (task.status === "completed" && jobOutbox.some((authority) => authority.state === "pending"
        && authority.lastError !== "WEBSITE_ATTEMPT_REPLACED"
        && authority.lastError !== "BUSINESS_ADMITTED"
        && authority.lastError !== "BROWSER_CLEANUP_PENDING"
        && authority.kind !== "provider_cooldown")) return false;
      if (!this.terminalTaskConsistent(task, terminal)) return false;
      const admissionPending = task.status === "failed" && task.staged_result !== null;
      if ((task.status === "completed" || admissionPending)
        && !completionPayloadConsistent(task, terminal!, projection)) return false;
    }
    return true;
  }
}
