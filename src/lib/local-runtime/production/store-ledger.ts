import { executionFailure } from "../../typed-failure.js";
import {
  hashCanonical,
  parseTerminalReceipt,
  parseTerminalReceiptExpectation,
  type ProductionHash,
} from "./contracts.js";
import { routeProducesGeneratedImage } from "./route-policy.js";
import { ProductionStoreOutbox } from "./store-outbox.js";
import {
  json,
  resolveProductionAuthority,
  type ProductionOutboxWrite,
  type StoredProductionTask,
} from "./store-foundation.js";

type TerminalRow = Readonly<{ body_blob: Buffer; response_json: string | null }>;
type LedgerRow = Readonly<{
  kind: ProductionOutboxWrite["kind"];
  path: string;
  body_blob: Buffer;
  response_json: string | null;
  receipt_hash: ProductionHash | null;
}>;

type LedgerProjection = {
  terminalByJob: Map<string, Record<string, unknown>>;
  artifactCountByJob: Map<string, number>;
  artifactReceiptsByJob: Map<string, ProductionHash[]>;
  generatedImageByJob: Set<string>;
};

const legacyReceiptMatches = (
  receipt: unknown,
  request: Record<string, unknown>,
): boolean => Boolean(receipt && typeof receipt === "object" && !Array.isArray(receipt)
  && (receipt as Record<string, unknown>).job_id === request.job_id
  && (receipt as Record<string, unknown>).terminal_status === request.terminal_status
  && (receipt as Record<string, unknown>).payload_hash === request.payload_hash);

const parsePersistedReceipt = (value: string | null): unknown => {
  try { return value ? JSON.parse(value) as unknown : null; }
  catch (cause) {
    throw executionFailure("review_required", "PRODUCTION_TERMINAL_RECEIPT_PERSISTED_INVALID", { cause });
  }
};

const terminalAlreadyMatches = (
  task: StoredProductionTask,
  receipt: ReturnType<typeof parseTerminalReceipt>,
): boolean => {
  const failureMatches = task.status === "failed"
    ? hashCanonical(task.failure) === hashCanonical(receipt.failure)
    : task.failure === null && receipt.failure === null;
  const resultMatches = task.status === "completed"
    ? Boolean(task.result) && hashCanonical(task.result) === receipt.payload_hash
    : task.result === null;
  return task.status === receipt.terminal_status && failureMatches && resultMatches;
};

const registerArtifact = (projection: LedgerProjection, row: LedgerRow, jobId: string): boolean => {
  projection.artifactCountByJob.set(jobId, (projection.artifactCountByJob.get(jobId) ?? 0) + 1);
  if (!row.receipt_hash) return false;
  projection.artifactReceiptsByJob.set(jobId, [
    ...(projection.artifactReceiptsByJob.get(jobId) ?? []), row.receipt_hash,
  ]);
  if (row.path.includes("/artifacts/generated_image/")) projection.generatedImageByJob.add(jobId);
  return true;
};

const registerTerminal = (
  projection: LedgerProjection,
  row: LedgerRow,
  jobId: string,
  task: StoredProductionTask | undefined,
): boolean => {
  try {
    const terminal = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>;
    if (terminal.terminal_status === "review_required" || terminal.terminal_status === "cancelled") {
      const receipt = row.response_json ? JSON.parse(row.response_json) as unknown : null;
      if (!task || !legacyReceiptMatches(receipt, terminal)) return false;
      projection.terminalByJob.set(jobId, { ...terminal, terminal_status: "failed", failure: task.failure });
      return true;
    }
    const expected = parseTerminalReceiptExpectation(terminal);
    if (expected.job_id !== jobId || !row.response_json) return false;
    parseTerminalReceipt(JSON.parse(row.response_json) as unknown, expected);
    projection.terminalByJob.set(jobId, terminal);
    return true;
  } catch { return false; }
};

const completedTaskConsistent = (
  task: StoredProductionTask,
  terminal: Record<string, unknown>,
  projection: LedgerProjection,
): boolean => {
  const jobId = task.task.job_id;
  if (!task.result || terminal.payload_hash !== hashCanonical(task.result)
    || task.result.evidence_refs.length === 0
    || task.result.evidence_refs.some((ref) => !/^rec-[a-f0-9]{64}$/u.test(ref))) return false;
  const generated = projection.generatedImageByJob.has(jobId);
  if (generated && !routeProducesGeneratedImage(task.task)) return false;
  if (projection.artifactCountByJob.get(jobId) !== (generated ? 3 : 2)) return false;
  const terminalReceipts = terminal.result_object_receipts;
  return Array.isArray(terminalReceipts)
    && terminalReceipts.every((receipt) => typeof receipt === "string")
    && [...terminalReceipts].sort().join("\0")
      === [...(projection.artifactReceiptsByJob.get(jobId) ?? [])].sort().join("\0");
};

export class ProductionStoreLedger extends ProductionStoreOutbox {
  private reconcileTerminalRow(row: TerminalRow): boolean {
    const request = JSON.parse(row.body_blob.toString("utf8")) as Record<string, unknown>;
    const rawReceipt = parsePersistedReceipt(row.response_json);
    if (request.terminal_status === "review_required" || request.terminal_status === "cancelled") {
      if (!legacyReceiptMatches(rawReceipt, request)) {
        throw executionFailure("review_required", "PRODUCTION_LEGACY_TERMINAL_RECEIPT_MISMATCH");
      }
      return false;
    }
    const receipt = parseTerminalReceipt(rawReceipt, parseTerminalReceiptExpectation(request));
    const task = this.readTask(receipt.job_id);
    if (!task) throw executionFailure("review_required", "PRODUCTION_TERMINAL_TASK_MISSING");
    if (task.status === "completed" || task.status === "failed") {
      if (!terminalAlreadyMatches(task, receipt)) {
        throw executionFailure("review_required", "PRODUCTION_TERMINAL_RECEIPT_LOCAL_STATE_MISMATCH");
      }
      return false;
    }
    const result = receipt.terminal_status === "completed" ? task.staged_result : null;
    if (receipt.terminal_status === "completed" && (!result || receipt.payload_hash !== hashCanonical(result))) {
      throw executionFailure("review_required", "PRODUCTION_TERMINAL_OUTBOX_RESULT_MISSING");
    }
    if (receipt.terminal_status === "failed"
      && receipt.payload_hash !== hashCanonical({ job_id: receipt.job_id, failure: receipt.failure })) {
      throw executionFailure("review_required", "PRODUCTION_TERMINAL_RECEIPT_FAILURE_HASH_MISMATCH");
    }
    this.setTerminal(
      receipt.job_id, receipt.terminal_status,
      receipt.terminal_status === "failed" ? receipt.failure : null, result,
    );
    return true;
  }

  public reconcileDeliveredTerminals(): number {
    const rows = this.database.prepare(`select body_blob,response_json from production_outbox
      where kind='terminal' and sent_at is not null and response_hash is not null
      order by created_at,idempotency_key`).all() as TerminalRow[];
    let reconciled = 0;
    for (const row of rows) if (this.reconcileTerminalRow(row)) reconciled += 1;
    return reconciled;
  }

  public resolveAuthority(
    authorityRef: string,
    authorityHash: ProductionHash,
  ): "verified" | "missing" | "mismatch" {
    return resolveProductionAuthority(this, authorityRef, authorityHash);
  }

  public pendingOutboxCount(): number {
    return Number((this.database.prepare(
      "select count(*) as count from production_outbox where sent_at is null",
    ).get() as { count: number }).count);
  }

  private buildLedgerProjection(
    tasks: ReadonlyMap<string, StoredProductionTask>,
  ): LedgerProjection | null {
    const rows = this.database.prepare(`select kind,path,body_blob,response_json,receipt_hash
      from production_outbox where failure_code is not 'REMOTE_JOB_ABSENT_HISTORICAL'
      order by created_at,idempotency_key`).all() as LedgerRow[];
    const projection: LedgerProjection = {
      terminalByJob: new Map(), artifactCountByJob: new Map(),
      artifactReceiptsByJob: new Map(), generatedImageByJob: new Set(),
    };
    for (const row of rows) {
      const match = /\/jobs\/([^/]+)\//u.exec(row.path);
      if (!match?.[1]) return null;
      const jobId = decodeURIComponent(match[1]);
      if (row.kind === "artifact" && !registerArtifact(projection, row, jobId)) return null;
      if (row.kind === "terminal" && !registerTerminal(projection, row, jobId, tasks.get(jobId))) return null;
    }
    return projection;
  }

  private terminalTaskConsistent(
    task: StoredProductionTask,
    terminal: Record<string, unknown> | undefined,
    historicalAbsent: boolean,
  ): boolean {
    const isTerminal = task.status === "completed" || task.status === "failed";
    if (historicalAbsent && isTerminal && !terminal) return true;
    if (isTerminal !== Boolean(terminal) || (terminal && terminal.terminal_status !== task.status)) return false;
    if (task.status === "failed") {
      return Boolean(task.failure && terminal?.failure !== undefined && json(task.failure) === json(terminal.failure));
    }
    return task.status !== "completed" || task.failure === null;
  }

  private activeTaskConsistent(
    task: StoredProductionTask,
    activeJobIds: ReadonlySet<string>,
  ): boolean {
    const jobId = task.task.job_id;
    const lease = this.readLease(jobId);
    const checkpoint = this.readCheckpoint(jobId);
    const activelyOwned = activeJobIds.has(jobId) && lease?.state === "active" && checkpoint !== null;
    const awaitingRecovery = !activeJobIds.has(jobId) && task.status === "recovery_pending"
      && lease?.state === "stale" && checkpoint !== null;
    return activelyOwned || awaitingRecovery;
  }

  public isLedgerConsistent(activeJobIds: ReadonlySet<string>): boolean {
    const tasks = new Map(this.taskAuthorities().map((record) => [record.task.job_id, record] as const));
    const outbox = this.outboxAuthorities();
    if (outbox.some((authority) => authority.failureCode !== "REMOTE_JOB_ABSENT_HISTORICAL"
      && (authority.state !== "delivered" || !authority.responseHash
        || (authority.kind === "artifact" && !authority.receiptHash)))) return false;
    const historical = new Set(outbox.filter(
      (authority) => authority.failureCode === "REMOTE_JOB_ABSENT_HISTORICAL",
    ).map((authority) => authority.jobId));
    const projection = this.buildLedgerProjection(tasks);
    if (!projection) return false;
    for (const [jobId, task] of tasks) {
      const terminal = projection.terminalByJob.get(jobId);
      if (!this.terminalTaskConsistent(task, terminal, historical.has(jobId))) return false;
      if (task.status === "completed" && !completedTaskConsistent(task, terminal!, projection)) return false;
      if (task.status !== "completed" && task.status !== "failed") {
        if (!this.activeTaskConsistent(task, activeJobIds)) return false;
        if ((projection.artifactCountByJob.get(jobId) ?? 0) > 0) return false;
      }
    }
    const lanes = this.database.prepare(`select lane_owner_job_id from production_continuations
      where lane_owner_job_id is not null`).all() as Array<{ lane_owner_job_id: string }>;
    return lanes.every((row) => activeJobIds.has(row.lane_owner_job_id));
  }
}
