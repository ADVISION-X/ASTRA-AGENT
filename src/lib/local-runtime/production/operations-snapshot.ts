import path from "node:path";

import { diagnoseRuntimeLog, discoverRuntimeLogScope, type RuntimeDiagnosis } from "../../runtime-logs/index.js";
import type { WorkbenchBrowserAuthority } from "../workbench-browser-authority-support.js";
import type { ProductionRuntimeHealth } from "./runtime-contract.js";
import { productionControlContractVersion } from "./control-contract-dependency.js";
import type { ProductionRuntimeStore } from "./store.js";
import type { ProductionWorkerSession } from "./worker-session.js";
import { readWorkerObservationV6, type WorkerObservationV6 } from "./worker-observation-client.js";

export type ObservationFreshness = Readonly<
  | { kind: "durable"; fresh_until: null }
  | { kind: "snapshot"; fresh_until: null }
  | { kind: "ttl"; fresh_until: string }
>;

export type OperationsObservationRow = Readonly<{
  axis: string;
  owner: string;
  current_value: unknown;
  reason_code: string | null;
  observed_at: string;
  freshness: ObservationFreshness;
  authority_ref: string | null;
  evidence_ref: string | null;
  completeness: "COMPLETE" | "DIAGNOSIS_INCOMPLETE" | "SOURCE_UNAVAILABLE";
}>;

export type ProductionOperationsSnapshot = Readonly<{
  schema_version: "agent-production-operations-snapshot.v1";
  observed_at: string;
  scope: Readonly<{
    status: "SELECTED" | "NO_ACTIVE_SCOPE" | "AMBIGUOUS_SCOPE" | "SOURCE_UNAVAILABLE";
    selected_job_id: string | null;
    candidates: readonly string[];
  }>;
  rows: readonly OperationsObservationRow[];
  diagnosis: RuntimeDiagnosis | null;
}>;

const snapshotFreshness = Object.freeze({ kind: "snapshot", fresh_until: null } as const);
const durableFreshness = Object.freeze({ kind: "durable", fresh_until: null } as const);
const row = (input: Omit<OperationsObservationRow, "freshness" | "evidence_ref" | "completeness"> &
  Partial<Pick<OperationsObservationRow, "freshness" | "evidence_ref" | "completeness">>): OperationsObservationRow =>
  Object.freeze({ freshness: snapshotFreshness, evidence_ref: null, completeness: "COMPLETE", ...input });

const websiteScope = (observation: WorkerObservationV6, requestedJobId?: string) => {
  const candidates = Object.freeze(observation.jobs.map((job) => job.job_id).sort());
  if (requestedJobId && candidates.includes(requestedJobId)) {
    return Object.freeze({ status: "SELECTED" as const, selected_job_id: requestedJobId, candidates });
  }
  if (candidates.length === 0) {
    return Object.freeze({ status: "NO_ACTIVE_SCOPE" as const, selected_job_id: null, candidates });
  }
  if (candidates.length === 1) {
    return Object.freeze({ status: "SELECTED" as const, selected_job_id: candidates[0]!, candidates });
  }
  return Object.freeze({ status: "AMBIGUOUS_SCOPE" as const, selected_job_id: null, candidates });
};

const unavailableWebsiteRow = (observedAt: string, reason: string): OperationsObservationRow => row({
  axis: "website", owner: "website", current_value: null, reason_code: reason,
  observed_at: observedAt, authority_ref: "website:worker-observation-v6", completeness: "SOURCE_UNAVAILABLE",
});

const websiteRows = (observation: WorkerObservationV6, selectedJobId: string | null): OperationsObservationRow[] => {
  const job = observation.jobs.find((candidate) => candidate.job_id === selectedJobId);
  const rows: OperationsObservationRow[] = [row({
    axis: "website_claim", owner: "website", current_value: {
      exclusion_counts: observation.claim_exclusion_counts,
      nearest_retry_not_before: observation.nearest_retry_not_before,
      scope_total: observation.scope_total,
      scope_truncated: observation.scope_truncated,
    },
    reason_code: observation.claim_exclusion_counts[0]?.reason_code ?? null,
    observed_at: observation.observed_at, authority_ref: "website:worker-observation-v6",
  })];
  if (!job) return rows;
  rows.push(row({ axis: "website_job", owner: "website", current_value: job.status,
    reason_code: job.current_reason_code, observed_at: observation.observed_at,
    authority_ref: job.authority_ref }));
  rows.push(row({ axis: "website_next_action", owner: "website",
    current_value: { code: job.next_action_code, at: job.next_action_at },
    reason_code: job.next_action_code, observed_at: observation.observed_at,
    freshness: snapshotFreshness,
    authority_ref: job.authority_ref }));
  rows.push(row({ axis: "business_admission", owner: "website-domain-consumer",
    current_value: job.business_admission_receipt_hash ? "accepted" : "not_accepted",
    reason_code: job.business_admission_receipt_hash ? null : "BUSINESS_ADMISSION_ABSENT",
    observed_at: observation.observed_at,
    freshness: job.business_admission_receipt_hash ? durableFreshness : snapshotFreshness,
    authority_ref: job.authority_ref, evidence_ref: job.business_admission_receipt_hash }));
  return rows;
};

const localRows = (input: Readonly<{
  observedAt: string; health: ProductionRuntimeHealth; store: ProductionRuntimeStore;
  browser: WorkbenchBrowserAuthority; jobId: string | null;
}>): OperationsObservationRow[] => {
  const { health, observedAt, jobId } = input;
  const rows = [
    row({ axis: "contract", owner: "agent-production-runtime", current_value: health.controlContractVersion,
      reason_code: health.controlContractVersion === productionControlContractVersion
        ? null : "CONTROL_CONTRACT_VERSION_MISMATCH",
      observed_at: observedAt, authority_ref: "agent:v6-control-contract-dependency" }),
    row({ axis: "runtime_session", owner: "agent-production-runtime", current_value: health.cloudState,
      reason_code: health.lastErrorCode, observed_at: observedAt,
      authority_ref: "agent:production-runtime-health" }),
    row({ axis: "claim_admission", owner: "agent-production-runtime", current_value: health.claimAdmissionState,
      reason_code: health.lastErrorCode, observed_at: observedAt,
      authority_ref: "agent:production-runtime-health" }),
    row({ axis: "execution", owner: "agent-production-runtime", current_value: { state: health.executionState,
      active_count: health.activeCount }, reason_code: health.lastErrorCode, observed_at: observedAt,
      authority_ref: "agent:production-runtime-health" }),
    row({ axis: "runtime_log_sink", owner: "runtime-logs", current_value: health.logSinkState,
      reason_code: health.logSinkState === "ready" ? null : "RUNTIME_LOG_SINK_UNAVAILABLE",
      observed_at: observedAt, authority_ref: "agent:production-runtime-health" }),
    row({ axis: "browser_authority", owner: "browser-session", current_value: health.browserAuthorityState,
      reason_code: health.browserAuthorityState === "present" ? null : "BROWSER_AUTHORITY_ABSENT",
      observed_at: observedAt, authority_ref: "browser:authority" }),
    row({ axis: "browser_target", owner: "browser-session", current_value: health.browserTargetState,
      reason_code: health.browserTargetState === "claimed" ? null : "BROWSER_TARGET_ABSENT",
      observed_at: observedAt, authority_ref: "browser:target" }),
    row({ axis: "browser_lane", owner: "browser-session", current_value: health.browserLaneState,
      reason_code: health.browserLaneState === "blocked" ? "BROWSER_LANE_BLOCKED" : null,
      observed_at: observedAt, authority_ref: "browser:lane" }),
  ];
  if (jobId) {
    const task = input.store.readTask(jobId);
    rows.push(row({ axis: "agent_task", owner: "agent-production-runtime", current_value: task ? {
      status: task.status, current_reason: task.current_reason, attempt_id: task.current_attempt_id,
      attempt_failure_code: task.attempt_failure?.code ?? null, staged_result: task.staged_result !== null,
      result: task.result !== null,
    } : null, reason_code: task?.current_reason ?? "LOCAL_TASK_ABSENT",
    observed_at: task?.updated_at ?? observedAt, freshness: snapshotFreshness,
    authority_ref: `production-task:${jobId}` }));
    const lease = input.store.readLease(jobId);
    rows.push(row({ axis: "lease_fence", owner: "agent-production-runtime", current_value: lease,
    reason_code: lease?.state ?? "LEASE_ABSENT", observed_at: observedAt,
    freshness: lease?.state === "active" && lease.expiresAt
      ? { kind: "ttl", fresh_until: lease.expiresAt } : snapshotFreshness,
    authority_ref: `production-lease:${jobId}` }));
    const checkpoint = input.store.readCheckpoint(jobId);
    rows.push(row({ axis: "checkpoint", owner: "agent-production-runtime", current_value: checkpoint,
      reason_code: checkpoint?.state ?? "CHECKPOINT_ABSENT", observed_at: observedAt,
      freshness: snapshotFreshness, authority_ref: `production-checkpoint:${jobId}` }));
  }
  const outbox = jobId ? input.store.outboxAuthorities().filter((entry) => entry.jobId === jobId) : [];
  rows.push(row({ axis: "outbox", owner: "outbox", current_value: jobId ? outbox : {
      pending_count: health.pendingOutboxCount,
    },
    reason_code: outbox.find((entry) => entry.lastError)?.lastError ?? null,
    observed_at: observedAt, freshness: snapshotFreshness,
    authority_ref: jobId ? `production-outbox:${jobId}` : "agent:production-runtime-health" }));
  rows.push(row({ axis: "browser_wal", owner: "browser-session",
    current_value: { job_effect_present: jobId ? input.browser.hasBrowserMutationForJob(jobId) : null,
      unresolved_effect_present: input.browser.hasUnresolvedBrowserMutation() },
    reason_code: null, observed_at: observedAt, freshness: snapshotFreshness,
    authority_ref: jobId ? `browser-mutation-wal:${jobId}` : "browser-mutation-wal" }));
  return rows;
};

export const readProductionOperationsSnapshot = async (input: Readonly<{
  dataDir: string; store: ProductionRuntimeStore; browser: WorkbenchBrowserAuthority;
  health: () => ProductionRuntimeHealth; session: ProductionWorkerSession | null; jobId: string | undefined;
}>): Promise<ProductionOperationsSnapshot> => {
  const observedAt = new Date().toISOString();
  let observation: WorkerObservationV6 | null = null;
  let websiteError: string | null = null;
  try {
    if (!input.session) throw new Error("PRODUCTION_SESSION_NOT_OPEN");
    observation = await readWorkerObservationV6(input.session, input.jobId);
  } catch (error) {
    websiteError = (error instanceof Error ? error.message : String(error)).replace(/\s+/gu, " ").slice(0, 512);
  }
  const scope = observation ? websiteScope(observation, input.jobId) : Object.freeze({
    status: "SOURCE_UNAVAILABLE" as const, selected_job_id: null, candidates: Object.freeze([] as string[]),
  });
  const rows = observation ? websiteRows(observation, scope.selected_job_id)
    : [unavailableWebsiteRow(observedAt, websiteError ?? "SOURCE_UNAVAILABLE")];
  rows.push(...localRows({ observedAt, health: input.health(), store: input.store,
    browser: input.browser, jobId: scope.selected_job_id }));
  const logSources = [path.join(input.dataDir, "runtime-logs")];
  const diagnosis = scope.selected_job_id ? diagnoseRuntimeLog({
    sources: logSources, traceId: scope.selected_job_id,
    authorityResolver: (authorityRef, authorityHash) => input.store.resolveAuthority(authorityRef, authorityHash),
  }) : null;
  const discoveredLogScope = diagnosis ? null : discoverRuntimeLogScope({ sources: logSources });
  rows.push(row({ axis: "runtime_log_evidence", owner: "runtime-logs",
    current_value: diagnosis?.blockingRoots ?? discoveredLogScope,
    reason_code: diagnosis?.blockingRoots[0]?.code ?? (discoveredLogScope?.status === "SOURCE_UNAVAILABLE"
      ? "SOURCE_UNAVAILABLE" : discoveredLogScope?.status === "AMBIGUOUS_SCOPE" ? "AMBIGUOUS_SCOPE" : null),
    observed_at: observedAt, freshness: durableFreshness, authority_ref: "runtime-log-spine",
    evidence_ref: diagnosis?.blockingRoots[0]?.eventId ?? null,
    completeness: diagnosis?.status === "DIAGNOSIS_COMPLETE" ? "COMPLETE"
      : diagnosis?.status ?? (discoveredLogScope?.status === "SOURCE_UNAVAILABLE" ? "SOURCE_UNAVAILABLE"
        : discoveredLogScope?.completeness ?? "DIAGNOSIS_INCOMPLETE") }));
  return Object.freeze({ schema_version: "agent-production-operations-snapshot.v1", observed_at: observedAt,
    scope, rows: Object.freeze(rows), diagnosis });
};
