import {
  RESULT_CONTRACT_ID,
  RESULT_CONTRACT_VERSION,
  TASK_CONTRACT_ID,
  TASK_CONTRACT_VERSION,
  WebsiteAgentResultSchema,
  WebsiteAgentTaskSchema,
  hashCanonical,
  type ProductionActionId,
  type ProductionHash,
  type ProductionProductId,
  type WebsiteAgentResult,
  type WebsiteAgentTask,
} from "../../src/lib/local-runtime/production/contracts.js";
import { productionCatalogHash } from "../../src/lib/local-runtime/production/catalog.js";
import {
  ClaimedProductionTaskSchema,
  type ClaimedProductionTask,
} from "../../src/lib/local-runtime/production/transport-protocol.js";
import { authorizeWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import type {
  AttemptFailureFirstFact,
  SerializedExecutionFailure,
  SerializedTerminalFailure,
} from "../../src/lib/local-runtime/production/terminal-failure.js";

export const HASH_A = `sha256:${"a".repeat(64)}` as ProductionHash;
export const HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;
export const HASH_C = `sha256:${"c".repeat(64)}` as ProductionHash;
export const ADMISSION_JOB_ID = "job:business-admission";

export const attemptFailureFirstFact = (
  attemptId: string,
  failure: SerializedExecutionFailure | SerializedTerminalFailure,
  leaseVersion = 1,
): AttemptFailureFirstFact => {
  const failureCore: SerializedTerminalFailure = Object.freeze({
    ...failure,
    provider_effect_identity_hash: "provider_effect_identity_hash" in failure
      ? failure.provider_effect_identity_hash : null,
    settled_result_payload_hash: "settled_result_payload_hash" in failure
      ? failure.settled_result_payload_hash : null,
  });
  const bodyPayloadHash = hashCanonical({ attempt_id: attemptId, lease_version: leaseVersion, failureCore });
  return Object.freeze({
    failure_core: failureCore,
    release_descriptor: Object.freeze({
      attempt_id: attemptId,
      lease_version: leaseVersion,
      request_id: `aiprelease_${bodyPayloadHash.slice(7, 47)}`,
      body_payload_hash: bodyPayloadHash,
      write_request_payload_hash: hashCanonical({ bodyPayloadHash, attemptId, leaseVersion }),
    }),
  });
};

export const admissionReceiptFor = (
  jobId: string,
  resultPayloadHash: string,
  extra: Readonly<Record<string, unknown>> = {},
) => {
  const authority = {
    job_id: jobId,
    result_payload_hash: resultPayloadHash,
    ...extra,
    consumer_ref: "business-result-consumer.v1",
    outcome: "completed" as const,
  };
  return {
    schema_version: "xuanxue-ai-business-admission-receipt.v6",
    ...authority,
    consumption_hash: hashCanonical(authority),
    consumed_at: "2026-09-03T00:00:00.000Z",
  };
};

export const admissionReceipt = (extra: Readonly<Record<string, unknown>> = {}) =>
  admissionReceiptFor(ADMISSION_JOB_ID, HASH_A, extra);

export const deviceStatusWithAdmission = (
  receipt: unknown,
  jobId = ADMISSION_JOB_ID,
  terminalPayloadHash: string = HASH_B,
) => ({
  request: async () => ({
    schema_version: "xuanxue-ai-device-job-status.v6", job_id: jobId, status: "completed",
    current_reason: null,
    control_intent: { schema_version: "xuanxue-ai-control-intent.v6", job_id: jobId,
      control_epoch: 0, intent: "none", reason_code: null },
    next_action_code: "CONSUME_CURRENT_RESULT", terminal_status: "completed",
    attempt_failure: null,
    terminal_payload_hash: terminalPayloadHash, business_admission_receipt: receipt,
    business_consumer_error: null, accepted_attempt_count: 1, write_receipts: [],
  }),
}) as never;

export const deviceStatusWithoutAdmission = (
  jobId: string,
  deleted = false,
  nextAction: "ACTIVE_ATTEMPT" | "WAIT_NEW_ATTEMPT" = "ACTIVE_ATTEMPT",
  reasonCode: string | null = deleted ? "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" : null,
) => ({
  request: async () => ({
    schema_version: "xuanxue-ai-device-job-status.v6", job_id: jobId, status: "failed",
    current_reason: reasonCode ? { code: reasonCode } : null,
    control_intent: { schema_version: "xuanxue-ai-control-intent.v6", job_id: jobId,
      control_epoch: deleted ? 1 : 0, intent: deleted ? "cancel_requested" : "none",
      reason_code: deleted ? "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" : null },
    next_action_code: nextAction, terminal_status: null, terminal_payload_hash: null,
    attempt_failure: null,
    business_admission_receipt: null, business_consumer_error: null,
    accepted_attempt_count: 1, write_receipts: [],
  }),
}) as never;

export const validDeviceCredential = {
  protocol_version: "xuanxue-ai-production-v6",
  server_base_url: "http://127.0.0.1:4322",
  environment_id: "production",
  origin: "http://127.0.0.1:4173",
  device_id: "device:projection-owner-test",
  device_epoch: 7,
  credential: `aidc_v6_${"a".repeat(32)}`,
  enrolled_at: new Date().toISOString(),
} as const;

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
): WebsiteAgentResult => WebsiteAgentResultSchema.parse({
  schema_version: "website-agent-result.v1", job_id: accepted.job_id, source_task_id: accepted.source_task_id,
  product_id: accepted.product_id, action_id: accepted.action_id, result_contract_id: RESULT_CONTRACT_ID,
  result_contract_version: RESULT_CONTRACT_VERSION, result_payload_ref: `object:${accepted.job_id}`,
  result_payload_hash: HASH_B, result_payload_bytes: 2, result_payload_media_type: "application/json",
  result_object_receipt: { object_ref: `object:${accepted.job_id}`, sha256: HASH_B, bytes: 2,
    media_type: "application/json", receipt_hash: HASH_C },
  evidence_refs: ["evidence:provider"], execution_receipt_hash: HASH_A,
}) as WebsiteAgentResult;

const executionGrant = (base: WebsiteAgentTask) => {
  const route = {
    schema_version: "xuanxue-ai-cloud-execution-grant.v6", control_protocol_version: "xuanxue-ai-production-v6",
    claim_batch_id: `claim:${base.job_id}`, job_id: base.job_id, source_task_id: base.source_task_id,
    request_hash: base.request_hash, task_contract_id: TASK_CONTRACT_ID, task_contract_version: TASK_CONTRACT_VERSION,
    result_contract_id: RESULT_CONTRACT_ID, result_contract_version: RESULT_CONTRACT_VERSION,
    capability_manifest_hash: productionCatalogHash,
    accepted_attempt_count: 1, max_provider_turns: 8,
    result_revision: 0, prior_result_rejection: null,
  } as const;
  return {
    ...route, attempt_id: `attempt:${base.job_id}`, device_id: "device:1", device_epoch: 1,
    worker_session_id: "worker:1", worker_session_epoch: 1, lease_token: `lease:${base.job_id}`,
    lease_version: 1, server_now: "2030-01-01T00:00:00.000Z",
    lease_expires_at: "2030-01-01T00:05:00.000Z", renew_after_ms: 20_000,
    control_contract_version: 37,
    execution_fence: {
      schema_version: "xuanxue-ai-execution-fence.v6", environment_id: "production", device_id: "device:1",
      device_epoch: 1, worker_session_id: "worker:1", worker_session_epoch: 1, job_id: base.job_id,
      attempt_id: `attempt:${base.job_id}`, lease_version: 1, lease_token_hash: HASH_A,
      control_contract_version: 37, fence_hash: HASH_B,
    },
  } as const;
};

export const claimTask = (base: WebsiteAgentTask): ClaimedProductionTask => {
  authorizeWebsiteAgentTask(base);
  return ClaimedProductionTaskSchema.parse({
    ...base, status: "failed", current_reason: "LEASE_GRANTED", lease_owner: "device:1",
    lease_expires_at: "2030-01-01T00:05:00.000Z",
    lease_token: `lease:${base.job_id}`, lease_version: 1,
    grant: executionGrant(base),
  });
};
