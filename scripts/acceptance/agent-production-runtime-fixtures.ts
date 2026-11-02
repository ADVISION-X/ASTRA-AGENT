import {
  RESULT_CONTRACT_ID,
  RESULT_CONTRACT_VERSION,
  TASK_CONTRACT_ID,
  TASK_CONTRACT_VERSION,
  WebsiteAgentResultSchema,
  WebsiteAgentTaskSchema,
  hashCanonical,
  sha256,
  type ProductionActionId,
  type ProductionHash,
  type ProductionProductId,
  type WebsiteAgentResult,
  type WebsiteAgentTask,
} from "../../src/lib/local-runtime/production/contracts.js";
import { productionCatalogHash } from "../../src/lib/local-runtime/production/catalog.js";
import type { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { ProductionExecutor } from "../../src/lib/local-runtime/production/executor.js";
import { ProductionWorkerSession } from "../../src/lib/local-runtime/production/worker-session.js";
import { ProviderRateLimitControl } from "../../src/lib/local-runtime/production/provider-rate-limit-control.js";
import { runtimeState } from "../../src/lib/local-runtime/production/runtime-loops.js";
import type { RuntimeState } from "../../src/lib/local-runtime/production/runtime-state.js";
import { createGptAbilityGroup } from "../../src/capabilities/gpt/index.js";
import { createForensicsPersistenceAbilityGroupFromStorage } from "../../src/capabilities/forensics-persistence/index.js";
import { createGrassEyeFileStorage } from "../../src/lib/storage/index.js";
import {
  ClaimedProductionTaskSchema,
  DeviceCredentialSchema,
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
  stagedResult: WebsiteAgentResult | null = null,
  writeReceipts: readonly unknown[] = [],
) => ({
  request: async () => ({
    schema_version: "xuanxue-ai-device-job-status.v6", job_id: jobId, status: "completed",
    current_reason: null,
    control_intent: { schema_version: "xuanxue-ai-control-intent.v6", job_id: jobId,
      control_epoch: 0, intent: "none", reason_code: null },
    next_action_code: "CONSUME_CURRENT_RESULT", terminal_status: "completed",
    attempt_failure: null,
    terminal_payload_hash: terminalPayloadHash, business_admission_receipt: receipt,
    business_consumer_error: null, accepted_attempt_count: 1, write_receipts: writeReceipts,
    staged_result: stagedResult, staged_artifact_receipts: [],
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
    staged_result: null, staged_artifact_receipts: [],
  }),
});

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

const unusedRuntimeFixtureOperation = (): never => { throw new Error("UNEXPECTED_RUNTIME_FIXTURE_OPERATION"); };

export const shutdownRuntimeFixture = (input: Readonly<{
  store: ProductionRuntimeStore;
  dataDir: string;
  runtimeLogger: RuntimeState["runtimeLogger"];
  session?: ProductionWorkerSession;
  browser?: Partial<RuntimeState["browserAuthority"]>;
}>): RuntimeState => {
  const browserAuthority: RuntimeState["browserAuthority"] = {
    broker: { currentStatus: unusedRuntimeFixtureOperation },
    health: unusedRuntimeFixtureOperation,
    readOperatorPairingState: unusedRuntimeFixtureOperation,
    readReleaseBuildId: unusedRuntimeFixtureOperation,
    readProductionRuntimeState: () => ({ browserAuthorityState: "present", browserTargetState: "absent" }),
    readBrowserLaneState: () => "idle",
    bindExecutionArtifacts: unusedRuntimeFixtureOperation,
    hasUnresolvedBrowserMutation: () => false,
    hasBrowserMutationForJob: unusedRuntimeFixtureOperation,
    readJobBrowserHistoryEvidence: unusedRuntimeFixtureOperation,
    readJobPhysicalInputState: unusedRuntimeFixtureOperation,
    readAttemptPhysicalInputState: unusedRuntimeFixtureOperation,
    verifyRuntimeTaskProvenance: unusedRuntimeFixtureOperation,
    countProviderTurnDispatches: unusedRuntimeFixtureOperation,
    readProviderEffectStepCallFact: unusedRuntimeFixtureOperation,
    readConfirmedRateLimitAcknowledgement: unusedRuntimeFixtureOperation,
    readProvenZeroInputProviderCommand: unusedRuntimeFixtureOperation,
    readSourceConfirmedProviderEffect: unusedRuntimeFixtureOperation,
    purgeBrowserJob: unusedRuntimeFixtureOperation,
    releaseJobBoundTarget: unusedRuntimeFixtureOperation,
    acquireJobBoundTargetLease: unusedRuntimeFixtureOperation,
    acceptBrowserAuthoritySocket: unusedRuntimeFixtureOperation,
    shutdown: unusedRuntimeFixtureOperation,
    ...input.browser,
  };
  const session = input.session ?? new ProductionWorkerSession(DeviceCredentialSchema.parse(validDeviceCredential),
    () => runtimeState(state), HASH_A, () => input.runtimeLogger.isWritable(), "worker:shutdown-fixture");
  if (!input.session) {
    session.request = unusedRuntimeFixtureOperation;
    session.close = unusedRuntimeFixtureOperation;
  }
  const providerRateLimitControl = new ProviderRateLimitControl(input.store, session);
  const gpt = createGptAbilityGroup();
  const evidenceStore = createForensicsPersistenceAbilityGroupFromStorage(createGrassEyeFileStorage(input.dataDir));
  const executor = new ProductionExecutor(input.store, input.runtimeLogger, {
    dataDir: input.dataDir, sourceHash: HASH_A, gpt, evidenceStore, browserAuthority, providerRateLimitControl,
  });
  const state: RuntimeState = {
    abort: new AbortController(), active: new Map(), activeAbort: new Map(),
    store: input.store, executor, session, providerRateLimitControl, browserAuthority, gpt, evidenceStore,
    dataDir: input.dataDir, runtimeLogger: input.runtimeLogger,
    draining: false, iteration: null, drainJobIds: null, lastHeartbeat: null,
    lastErrorCode: null, lastErrorReason: null, stopped: false, ledgerReconciled: false,
    lastStatusJobId: null, lastTransportJobId: null,
  };
  return state;
};

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

export const stageResultForAcceptance = (
  store: ProductionRuntimeStore, jobId: string, attemptId: string, result: WebsiteAgentResult,
) => {
  const firstRaw = store.readAttemptFailureRaw(jobId);
  const envelopeReceipt = result.result_object_receipt.receipt_hash === HASH_A ? HASH_B : HASH_A;
  const receipts = [result.result_object_receipt.receipt_hash, envelopeReceipt];
  const key = `terminal:acceptance:${jobId}:${attemptId}`;
  const terminal = { idempotency_key: key, kind: "terminal" as const,
      path: `/internal/ai-production/v6/jobs/${encodeURIComponent(jobId)}/terminal`,
      method: "POST" as const, headers: {}, body: JSON.stringify({
        schema_version: "xuanxue-ai-terminal-cas.v6", job_id: jobId,
        attempt_id: attemptId, terminal_status: "completed",
        payload_hash: hashCanonical(result), failure: null,
        worker_session_id: "session:acceptance", worker_session_epoch: 1,
        result_object_receipts: receipts,
        terminal_source_first_fact: firstRaw === null ? null
          : { raw_json: firstRaw, hash: sha256(Buffer.from(firstRaw, "utf8")) },
      }) };

  store.stageResultAndEnqueueTerminal({
    jobId, attemptId, result, terminal,
    websiteStagedArtifactReceipts: [
      { role: "result_payload", receipt_hash: receipts[0]! },
      { role: "result_envelope", receipt_hash: receipts[1]! },
    ],
  });
  return { request_id: key, write_kind: "terminal" as const,
    payload_hash: hashCanonical(JSON.parse(terminal.body)), response_json: {
      schema_version: "xuanxue-ai-terminal-receipt.v6", job_id: jobId, terminal_status: "completed",
      payload_hash: hashCanonical(result), failure: null, first_terminal: true,
      device_id: "device:acceptance", device_epoch: 1, worker_session_id: "session:acceptance",
      worker_session_epoch: 1, runtime_attestation_receipt_hash: HASH_A,
    } };

};

const executionGrant = (base: WebsiteAgentTask) => {
  const route = {
    schema_version: "xuanxue-ai-cloud-execution-grant.v6", control_protocol_version: "xuanxue-ai-production-v6",
    claim_batch_id: `claim:${base.job_id}`, job_id: base.job_id, source_task_id: base.source_task_id,
    request_hash: base.request_hash, task_contract_id: TASK_CONTRACT_ID, task_contract_version: TASK_CONTRACT_VERSION,
    result_contract_id: RESULT_CONTRACT_ID, result_contract_version: RESULT_CONTRACT_VERSION,
    capability_manifest_hash: productionCatalogHash,
    accepted_attempt_count: 1, max_provider_turns: 8,
    same_accepted_attempt: false, delivery_only: false,
    source_handoff_seal_hash: null,
    delivery_priority_replay_grant: null,
    result_revision: 0, prior_result_rejection: null,
  } as const;
  return {
    ...route, attempt_id: `attempt:${base.job_id}`, device_id: "device:1", device_epoch: 1,
    worker_session_id: "worker:1", worker_session_epoch: 1, lease_token: `lease:${base.job_id}`,
    lease_version: 1, server_now: "2030-01-01T00:00:00.000Z",
    lease_expires_at: "2030-01-01T00:05:00.000Z", renew_after_ms: 20_000,
    control_contract_version: 49,
    execution_fence: {
      schema_version: "xuanxue-ai-execution-fence.v6", environment_id: "production", device_id: "device:1",
      device_epoch: 1, worker_session_id: "worker:1", worker_session_epoch: 1, job_id: base.job_id,
      attempt_id: `attempt:${base.job_id}`, lease_version: 1, lease_token_hash: HASH_A,
      control_contract_version: 49, fence_hash: HASH_B,
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

export const renewReceiptForClaim = (job: ClaimedProductionTask) => ({
  schema_version: "xuanxue-ai-lease-renew-receipt.v6", job_id: job.job_id,
  server_now: job.grant.server_now, lease_expires_at: job.grant.lease_expires_at, renew_after_ms: 20_000,
  control_intent: { schema_version: "xuanxue-ai-control-intent.v6", job_id: job.job_id,
    intent: "none", control_epoch: 0, reason_code: null },
});

export const failureStatus = (
  jobId: string,
  attemptFailure: Readonly<Record<string, unknown>> | null,
  writeReceipts: readonly Readonly<Record<string, unknown>>[],
) => ({
  schema_version: "xuanxue-ai-device-job-status.v6",
  job_id: jobId,
  status: "failed",
  current_reason: null,
  attempt_failure: attemptFailure,
  control_intent: { schema_version: "xuanxue-ai-control-intent.v6",
    job_id: jobId, control_epoch: 0, intent: "none", reason_code: null },
  next_action_code: "ACTIVE_ATTEMPT",
  terminal_status: null,
  terminal_payload_hash: null,
  business_admission_receipt: null,
  business_consumer_error: null,
  accepted_attempt_count: 1,
  write_receipts: writeReceipts,
  staged_result: null,
  staged_artifact_receipts: [],
});
