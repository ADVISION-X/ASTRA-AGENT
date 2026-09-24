import { hashCanonical, parseTerminalReceipt, parseTerminalReceiptExpectation, sha256,
  type ProductionHash, type TerminalReceipt } from "./contracts.js";
import type { ClaimedProductionTask } from "./transport-protocol.js";
import type { ProductionWorkerSession } from "./worker-session.js";
import type { ProductionRuntimeStore } from "./store.js";

export function buildTerminalProductionIntent(
  session: ProductionWorkerSession,
  job: ClaimedProductionTask,
  input: Readonly<{
    status: "completed";
    payload_hash: ProductionHash;
    result_receipt_hashes: readonly ProductionHash[];
    terminal_source_first_fact_raw: string | null;
  }>,
) {
  const firstFactHash = input.terminal_source_first_fact_raw === null
    ? null : sha256(Buffer.from(input.terminal_source_first_fact_raw, "utf8"));
  const requestId = `aipterminal_${hashCanonical({
    job_id: job.job_id,
    attempt_id: job.grant.attempt_id,
    lease_version: job.grant.lease_version,
    terminal_status: input.status,
    failure: null,
    payload_hash: input.payload_hash,
    result_object_receipts: input.result_receipt_hashes,
    terminal_source_first_fact_hash: firstFactHash,
  }).slice(7, 47)}`;
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(job.job_id)}/terminal`;
  const body = JSON.stringify({
    schema_version: "xuanxue-ai-terminal-cas.v6",
    control_protocol_version: "xuanxue-ai-production-v6",
    request_id: requestId,
    idempotency_key: requestId,
    job_id: job.job_id,
    worker_session_id: session.workerSessionId,
    worker_session_epoch: session.workerSessionEpoch,
    attempt_id: job.grant.attempt_id,
    lease_version: job.grant.lease_version,
    fence_hash: job.grant.execution_fence.fence_hash,
    terminal_status: input.status,
    failure: null,
    payload_hash: input.payload_hash,
    result_object_receipts: input.result_receipt_hashes,
    terminal_source_first_fact: input.terminal_source_first_fact_raw === null ? null
      : { raw_json: input.terminal_source_first_fact_raw,
        hash: firstFactHash },
  });
  parseTerminalReceiptExpectation(body);
  return Object.freeze({ requestId, write: Object.freeze({ idempotency_key: requestId,
    kind: "terminal" as const, path: pathname, method: "POST" as const,
    headers: { "x-ai-execution-fence-hash": job.grant.execution_fence.fence_hash }, body }) });
}

export async function deliverTerminalProductionIntent(
  session: ProductionWorkerSession,
  store: ProductionRuntimeStore,
  intent: ReturnType<typeof buildTerminalProductionIntent>,
): Promise<TerminalReceipt> {
  const expected = parseTerminalReceiptExpectation(intent.write.body);
  const response = await store.deliverOutbox(intent.requestId, async (write) => session.request(write.path, {
    method: write.method,
    headers: write.headers,
    body: Buffer.from(write.body),
  }));
  return parseTerminalReceipt(response, expected);
}
