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

const outboxIsIsolated = (failureCode: string | null): boolean =>
  failureCode === "REMOTE_JOB_ABSENT_HISTORICAL"
  || failureCode === "HISTORICAL_FAILED_COMPLETION_RETIRED"
  || failureCode === "EXECUTION_SLICE_RECONSTRUCTED"
  || failureCode?.startsWith("STALE_LEASE_OUTBOX_RETIRED:") === true;

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
  const result = task.status === "completed" ? task.result : task.staged_result;
  return Boolean(result) && receipt.terminal_status === "completed"
    && receipt.failure === null && hashCanonical(result) === receipt.payload_hash;
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
    if (terminal.terminal_status !== "completed") return false;
    const expected = parseTerminalReceiptExpectation(terminal);
    if (expected.job_id !== jobId || !row.response_json) return false;
    parseTerminalReceipt(JSON.parse(row.response_json) as unknown, expected);
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
    || result.evidence_refs.length === 0
    || result.evidence_refs.some((ref) => !/^rec-[a-f0-9]{64}$/u.test(ref))) return false;
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
    if (request.terminal_status !== "completed") return false;
    const receipt = parseTerminalReceipt(rawReceipt, parseTerminalReceiptExpectation(request));
    const task = this.readTask(receipt.job_id);
    if (!task) throw executionFailure("review_required", "PRODUCTION_TERMINAL_TASK_MISSING");
    if (!terminalAlreadyMatches(task, receipt)) {
      if (!task.staged_result || receipt.payload_hash !== hashCanonical(task.staged_result)) {
      throw executionFailure("review_required", "PRODUCTION_TERMINAL_OUTBOX_RESULT_MISSING");
      }
    }
    return false;
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

  public parkedOutboxCount(): number {
    return Number((this.database.prepare(
      "select count(*) as count from production_outbox where sent_at is null and delivery_parked_at is not null",
    ).get() as { count: number }).count);
  }

  private buildLedgerProjection(
    tasks: ReadonlyMap<string, StoredProductionTask>,
  ): LedgerProjection | null {
    const rows = this.database.prepare(`select kind,path,body_blob,response_json,receipt_hash
      from production_outbox
      where sent_at is not null and response_hash is not null
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
    isolatedRemoteAuthority: boolean,
  ): boolean {
    const isTerminal = task.status === "completed";
    const admissionPending = task.status === "recovery_pending" && task.staged_result !== null;
    if (isolatedRemoteAuthority && isTerminal && !terminal) return true;
    if (admissionPending) return Boolean(terminal && terminal.terminal_status === "completed");
    if (isTerminal !== Boolean(terminal) || (terminal && terminal.terminal_status !== task.status)) return false;
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
    return activelyOwned || awaitingRecovery || this.isRemoteRedeliveryPending(jobId);
  }

  public isLedgerConsistent(activeJobIds: ReadonlySet<string>): boolean {
    const tasks = new Map(this.taskAuthorities().map((record) => [record.task.job_id, record] as const));
    const outbox = this.outboxAuthorities();
    if (outbox.some((authority) => authority.state === "delivered"
      && (!authority.responseHash || (authority.kind === "artifact" && !authority.receiptHash)))) return false;
    if (outbox.some((authority) => authority.state !== "delivered" && !outboxIsIsolated(authority.failureCode)
      && (!tasks.has(authority.jobId) || tasks.get(authority.jobId)?.status === "completed"))) return false;
    const isolated = new Set(outbox.filter(
      (authority) => outboxIsIsolated(authority.failureCode),
    ).map((authority) => authority.jobId));
    const projection = this.buildLedgerProjection(tasks);
    if (!projection) return false;
    for (const [jobId, task] of tasks) {
      const terminal = projection.terminalByJob.get(jobId);
      const jobOutbox = outbox.filter((authority) => authority.jobId === jobId);
      if (task.status === "completed" && jobOutbox.some(
        (authority) => authority.state !== "delivered" && !outboxIsIsolated(authority.failureCode),
      )) return false;
      if (!this.terminalTaskConsistent(task, terminal, isolated.has(jobId))) return false;
      const admissionPending = task.status === "recovery_pending" && task.staged_result !== null;
      if ((task.status === "completed" || admissionPending)
        && !completionPayloadConsistent(task, terminal!, projection)) return false;
      if (task.status !== "completed" && !admissionPending) {
        if (!this.activeTaskConsistent(task, activeJobIds)) return false;
      }
    }
    const lanes = this.database.prepare(`select lane_owner_job_id from production_continuations
      where lane_owner_job_id is not null`).all() as Array<{ lane_owner_job_id: string }>;
    return lanes.every((row) => activeJobIds.has(row.lane_owner_job_id));
  }
}
