import assert from "node:assert/strict";

import {
  RESULT_CONTRACT_ID,
  RESULT_CONTRACT_VERSION,
  TASK_CONTRACT_ID,
  TASK_CONTRACT_VERSION,
  WebsiteAgentResultSchema,
  WebsiteAgentTaskSchema,
  hashCanonical,
  type DurablePluginIdentity,
  type ProductionActionId,
  type ProductionHash,
  type ProductionProductId,
  type WebsiteAgentResult,
  type WebsiteAgentTask,
} from "../../src/lib/local-runtime/production/contracts.js";
import { productionCatalogHash, resolveProductionPlugin } from "../../src/lib/local-runtime/production/catalog.js";
import {
  ClaimedProductionTaskSchema,
  PRODUCTION_V6_MANIFEST_HASH,
  type ClaimedProductionTask,
} from "../../src/lib/local-runtime/production/transport-protocol.js";
import { authorizeWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { executionFailure, serializeTerminalFailure } from "../../src/lib/typed-failure.js";

export const HASH_A = `sha256:${"a".repeat(64)}` as ProductionHash;
export const HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;
export const HASH_C = `sha256:${"c".repeat(64)}` as ProductionHash;

export const task = (input: Readonly<{
  jobId: string;
  productId: ProductionProductId;
  actionId: ProductionActionId;
  materialRefs?: readonly Record<string, unknown>[];
  extra?: Readonly<Record<string, unknown>>;
}>): WebsiteAgentTask => {
  const draft = {
    schema_version: "website-agent-task.v1", protocol_version: "xuanxue-ai-production-v6", job_id: input.jobId,
    source_task_id: `source:${input.jobId}`, product_id: input.productId, action_id: input.actionId,
    idempotency_key: `idempotency:${input.jobId}`, task_contract_id: TASK_CONTRACT_ID,
    task_contract_version: TASK_CONTRACT_VERSION,
    business_identity: { owner_ref: "owner:1", subject_ref: "subject:1", authorization_ref: "authorization:1" },
    business_context_ref: `context:${input.jobId}`, business_context_hash: HASH_A, parameters: {},
    material_refs: input.materialRefs ?? [], result_contract_id: RESULT_CONTRACT_ID,
    result_contract_version: RESULT_CONTRACT_VERSION, ...(input.extra ?? {}),
  };
  const { job_id: _jobId, ...canonical } = draft;
  return WebsiteAgentTaskSchema.parse({ ...draft, request_hash: hashCanonical(canonical) });
};

export const resultFor = (
  accepted: WebsiteAgentTask,
  identity: DurablePluginIdentity,
): WebsiteAgentResult => WebsiteAgentResultSchema.parse({
  schema_version: "website-agent-result.v1", job_id: accepted.job_id, source_task_id: accepted.source_task_id,
  product_id: accepted.product_id, action_id: accepted.action_id, plugin_id: identity.plugin_id,
  plugin_version: identity.plugin_version, result_contract_id: RESULT_CONTRACT_ID,
  result_contract_version: RESULT_CONTRACT_VERSION, result_payload_ref: `object:${accepted.job_id}`,
  result_payload_hash: HASH_B, result_payload_bytes: 2, result_payload_media_type: "application/json",
  result_object_receipt: { object_ref: `object:${accepted.job_id}`, sha256: HASH_B, bytes: 2,
    media_type: "application/json", receipt_hash: HASH_C },
  evidence_refs: ["evidence:provider"], execution_receipt_hash: HASH_A,
}) as WebsiteAgentResult;

export const identityFor = (accepted: WebsiteAgentTask): DurablePluginIdentity => {
  const resolved = authorizeWebsiteAgentTask(accepted);
  return {
    catalog_hash: productionCatalogHash, plugin_id: resolved.plugin.pluginId,
    plugin_version: resolved.plugin.pluginVersion, skill_hash: resolved.skillHash,
    checkpoint_schema_version: resolved.plugin.checkpointSchemaVersion, request_hash: accepted.request_hash,
  };
};

const executionGrant = (
  base: WebsiteAgentTask,
  plugin: Readonly<{ pluginId: string; pluginVersion: number }>,
) => {
  const route = {
    schema_version: "xuanxue-ai-cloud-execution-grant.v6", control_protocol_version: "xuanxue-ai-production-v6",
    claim_batch_id: `claim:${base.job_id}`, job_id: base.job_id, source_task_id: base.source_task_id,
    request_hash: base.request_hash, task_contract_id: TASK_CONTRACT_ID, task_contract_version: TASK_CONTRACT_VERSION,
    result_contract_id: RESULT_CONTRACT_ID, result_contract_version: RESULT_CONTRACT_VERSION,
    capability_manifest_hash: productionCatalogHash, expected_catalog_hash: productionCatalogHash,
    expected_plugin_id: plugin.pluginId, expected_plugin_version: plugin.pluginVersion,
    accepted_attempt_count: 1, max_provider_turns: 8,
  } as const;
  return {
    ...route, attempt_id: `attempt:${base.job_id}`, device_id: "device:1", device_epoch: 1,
    worker_session_id: "worker:1", worker_session_epoch: 1, lease_token: `lease:${base.job_id}`,
    lease_version: 1, server_now: "2030-01-01T00:00:00.000Z", accept_by: "2030-01-01T00:01:00.000Z",
    lease_expires_at: "2030-01-01T00:05:00.000Z", renew_after_ms: 20_000,
    control_contract_manifest_hash: PRODUCTION_V6_MANIFEST_HASH,
    execution_fence: {
      schema_version: "xuanxue-ai-execution-fence.v6", environment_id: "production", device_id: "device:1",
      device_epoch: 1, worker_session_id: "worker:1", worker_session_epoch: 1, job_id: base.job_id,
      attempt_id: `attempt:${base.job_id}`, lease_version: 1, lease_token_hash: HASH_A,
      control_contract_manifest_hash: PRODUCTION_V6_MANIFEST_HASH, fence_hash: HASH_B,
    },
  } as const;
};

export const claimTask = (base: WebsiteAgentTask): ClaimedProductionTask => {
  const plugin = resolveProductionPlugin(base.product_id, base.action_id).plugin;
  return ClaimedProductionTaskSchema.parse({
    ...base, status: "failed", current_reason: "LEASE_GRANTED", lease_owner: "device:1",
    lease_expires_at: "2030-01-01T00:05:00.000Z",
    lease_token: `lease:${base.job_id}`, lease_version: 1,
    grant: executionGrant(base, plugin),
  });
};

export const recoveryRemoteStatus = (writeReceipts: readonly unknown[] = []) => ({
  schema_version: "xuanxue-ai-device-job-status.v6",
  job_id: "job:recovery-parser",
  status: "failed",
  current_reason: { code: "LEASE_GRANTED" },
  attempt_failure: null,
  accepted_attempt_count: 7,
  terminal_status: null,
  terminal_payload_hash: null,
  terminal_failure: null,
  terminalized_at: null,
  terminal_receipt: null,
  business_admission_receipt: null,
  business_consumer_error: null,
  write_receipts: writeReceipts,
});

export const recoveryCheckpointBody = (input: Readonly<{
  jobId: string;
  attemptId: string;
  requestId: string;
  checkpointSeq: number;
  checkpointKind: "accepted" | "progress" | "attempt_failure";
  attemptFailure?: unknown;
}>) => ({
  schema_version: "xuanxue-ai-checkpoint.v6",
  control_protocol_version: "xuanxue-ai-production-v6",
  request_id: input.requestId,
  idempotency_key: input.requestId,
  job_id: input.jobId,
  worker_session_id: "worker:1",
  worker_session_epoch: 1,
  attempt_id: input.attemptId,
  lease_version: 1,
  fence_hash: HASH_A,
  local_order_id: input.jobId,
  checkpoint_seq: input.checkpointSeq,
  checkpoint_kind: input.checkpointKind,
  payload_hash: hashCanonical({
    job_id: input.jobId,
    attempt_id: input.attemptId,
    checkpoint_seq: input.checkpointSeq,
    checkpoint_kind: input.checkpointKind,
  }),
  object_receipts: [],
  attempt_failure: input.attemptFailure ?? null,
});

export const recoveryCheckpointReceipt = (
  body: ReturnType<typeof recoveryCheckpointBody>,
  acceptedAttemptCount: number,
) => {
  const response = {
    schema_version: "xuanxue-ai-checkpoint-receipt.v6",
    job_id: body.job_id,
    checkpoint_seq: body.checkpoint_seq,
    checkpoint_hash: hashCanonical(body),
    accepted_at: "2026-08-29T20:19:07.000Z",
    accepted_attempt_count: acceptedAttemptCount,
    status: "failed",
  };
  return {
    request_id: body.request_id,
    write_kind: "checkpoint",
    payload_hash: hashCanonical(body),
    response_json: response,
  } as const;
};

export const seedRecoveryIncident = async (
  store: ProductionRuntimeStore,
  suffix: string,
  rejectedPairCount = 1,
) => {
  const accepted = task({
    jobId: `job:recovery:${suffix}`, productId: "payment_screenshot_observation", actionId: "observe",
  });
  const job = claimTask(accepted);
  const attemptId = job.grant.attempt_id;
  store.acceptTask(accepted, identityFor(accepted), attemptId);
  const falseFailure = serializeTerminalFailure(executionFailure(
    "failed", "AI_V6_CHECKPOINT_SEQUENCE_INVALID", { cause: new Error("sequence") },
  ));
  store.recordAttemptFailure(accepted.job_id, attemptId, falseFailure);
  const pathname = `/internal/ai-production/v6/jobs/${encodeURIComponent(accepted.job_id)}/checkpoints`;
  const receipts = [
    recoveryCheckpointBody({
      jobId: accepted.job_id, attemptId, requestId: `${suffix}:accepted:1`,
      checkpointSeq: 1, checkpointKind: "accepted",
    }),
    recoveryCheckpointBody({
      jobId: accepted.job_id, attemptId, requestId: `${suffix}:progress:2`,
      checkpointSeq: 2, checkpointKind: "progress",
    }),
  ].map((body) => {
    const receipt = recoveryCheckpointReceipt(body, 1);
    store.enqueue({
      idempotency_key: body.request_id, kind: "checkpoint", path: pathname,
      method: "POST", headers: {}, body: JSON.stringify(body),
    });
    store.markOutboxSent(body.request_id, receipt.response_json);
    return receipt;
  });
  for (let pair = 1; pair <= rejectedPairCount; pair += 1) {
    const pairSuffix = rejectedPairCount === 1 ? "" : `:${pair}`;
    for (const body of [
      recoveryCheckpointBody({
        jobId: accepted.job_id, attemptId, requestId: `${suffix}:rejected${pairSuffix}:accepted:1`,
        checkpointSeq: 1, checkpointKind: "accepted",
      }),
      recoveryCheckpointBody({
        jobId: accepted.job_id, attemptId, requestId: `${suffix}:rejected${pairSuffix}:failure:2`,
        checkpointSeq: 2, checkpointKind: "attempt_failure", attemptFailure: falseFailure,
      }),
    ]) {
      store.enqueue({
        idempotency_key: body.request_id, kind: "checkpoint", path: pathname,
        method: "POST", headers: {}, body: JSON.stringify(body),
      });
      await assert.rejects(store.deliverOutbox(body.request_id, async () => {
        throw executionFailure("failed", "AI_V6_CHECKPOINT_SEQUENCE_INVALID", { httpStatus: 409 });
      }), /AI_V6_CHECKPOINT_SEQUENCE_INVALID/u);
    }
  }
  return { accepted, job, attemptId, falseFailure, pathname, receipts };
};

export type RecoveryIncident = Awaited<ReturnType<typeof seedRecoveryIncident>>;

export const reclaimedRecoveryJob = (incident: RecoveryIncident) => ({
  ...incident.job,
  lease_version: 2,
  lease_token: `lease:${incident.accepted.job_id}:2`,
  grant: {
    ...incident.job.grant,
    lease_version: 2,
    lease_token: `lease:${incident.accepted.job_id}:2`,
    execution_fence: {
      ...incident.job.grant.execution_fence,
      lease_version: 2,
      fence_hash: HASH_B,
    },
  },
}) as RecoveryIncident["job"];
