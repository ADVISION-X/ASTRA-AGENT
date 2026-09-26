import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import {
  agentRouteCapabilityManifest, productionCatalogHash,
} from "../../src/lib/local-runtime/production/catalog.js";
import { claimProductionTasks } from "../../src/lib/local-runtime/production/cloud-client.js";
import { readProductionDeviceJobStatus } from
  "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import {
  WebsiteAgentTaskSchema,
  hashCanonical,
} from "../../src/lib/local-runtime/production/contracts.js";
import { websiteJobAbsent } from
  "../../src/lib/local-runtime/production/runtime-business-admission.js";
import {
  ClaimBatchReceiptSchema, ClaimedProductionTaskSchema, LeaseRenewReceiptSchema, parseJsonEnvelope,
  websiteAgentTaskFromClaim,
} from "../../src/lib/local-runtime/production/transport-protocol.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { assertProductionTaskRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import {
  HASH_A,
  HASH_B,
  ADMISSION_JOB_ID,
  admissionReceipt,
  admissionReceiptFor,
  claimTask,
  deviceStatusWithAdmission,
  resultFor,
  task,
} from "./agent-production-runtime-fixtures.js";
import { exerciseOperationsAndBusinessAdmission } from
  "./agent-production-runtime-business-admission.acceptance-support.js";
import "./agent-production-runtime-ledger.acceptance.js";
import "./agent-production-runtime-proof-boundary.acceptance.js";
import "./agent-production-runtime-startup.acceptance.js";
import { exerciseHeartbeatResponseLossRecovery, exerciseWorkerSessionRotation } from
  "./agent-production-runtime-session-rotation-support.js";
import { exerciseLeaseRenewRetry } from "./agent-production-runtime-lease-renew-retry-support.js";
import { exerciseGeneratedImageTransport } from "./agent-production-runtime-generated-image.acceptance-support.js";
import {
  verifyGptDialogMismatchRuntimeContract,
  verifyKnownGptRateLimitRuntimeContract,
} from
  "./agent-production-runtime-dialog-failure.acceptance-support.js";
import { verifyAttemptFailureReadbackRuntimeContract } from
  "./agent-production-runtime-browser-failure.acceptance-support.js";
import { exerciseProductionRuntimeSourceBoundaries } from
  "./agent-production-runtime-recovery-boundary.acceptance-support.js";
assert.equal(hashCanonical(agentRouteCapabilityManifest.routes), productionCatalogHash);
await assert.rejects(
  claimProductionTasks({} as never, 5),
  /V6_CLAIM_LIMIT_INVALID/u,
);

const productionTask = task({
  jobId: "job:payment", productId: "payment_screenshot_observation", actionId: "observe",
  materialRefs: [{
    material_id: "material:1", ordinal: 0, role: "payment_screenshot", display_name: "payment.png",
    object_ref: "object:1", sha256: HASH_A, bytes: 10, media_type: "image/png",
    storage_class: "private_owner_scoped", owner_scope_hash: HASH_B,
    trust_class: "user_provided_data", may_issue_instruction: false,
  }],
  extra: { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } },
});
const reviewTask = task({
  jobId: "job:review", productId: "payment_screenshot_observation", actionId: "accuracy_challenge",
  materialRefs: [{
    material_id: "material:review", ordinal: 0, role: "subject_result", display_name: "result.json",
    object_ref: "result:subject", sha256: HASH_A, bytes: 10, media_type: "application/json",
    storage_class: "private_owner_scoped", owner_scope_hash: HASH_B,
    trust_class: "locked_fact", may_issue_instruction: false,
  }, {
    material_id: "material:review-context", ordinal: 1, role: "review_context", display_name: "context.json",
    object_ref: "context:review", sha256: HASH_B, bytes: 10, media_type: "application/json",
    storage_class: "private_owner_scoped", owner_scope_hash: HASH_B,
    trust_class: "locked_fact", may_issue_instruction: false,
  }],
  extra: {
    parameters: { challenge_id: "challenge:1", question_text: "Is the observation accurate?" },
    subject_task_ref: "task:subject", subject_result_ref: "result:subject",
    subject_result_hash: HASH_A, review_policy: "manual-accuracy-challenge.v1",
  },
});

assert.equal(authorizeWebsiteAgentTask(productionTask).task, productionTask);
assert.equal(authorizeWebsiteAgentTask(reviewTask).task, reviewTask);
const providerOwnedLongSourceTask = task({
  jobId: "job:long-provider-source", productId: "payment_screenshot_observation", actionId: "observe",
  materialRefs: [{
    ...productionTask.material_refs[0]!,
    material_id: `provider-material:${"x".repeat(299)}`,
  }],
  extra: { source_task_id: `provider-source:${"x".repeat(280)}` },
});
assert.equal(providerOwnedLongSourceTask.source_task_id.length, 296);
assert.equal(providerOwnedLongSourceTask.material_refs[0]?.material_id.length, 317);
assert.equal(claimTask(providerOwnedLongSourceTask).source_task_id, providerOwnedLongSourceTask.source_task_id);
assert.equal(resultFor(providerOwnedLongSourceTask).source_task_id, providerOwnedLongSourceTask.source_task_id);
assert.throws(() => WebsiteAgentTaskSchema.parse({ ...productionTask, plugin_id: "forbidden" }), /unrecognized_keys/u);
assert.throws(() => WebsiteAgentTaskSchema.parse({
  ...productionTask, material_refs: [{ ...productionTask.material_refs[0]!, may_issue_instruction: true }],
}), /AGENT_MATERIAL_INSTRUCTION_AUTHORITY_INVALID/u);
assert.throws(() => assertProductionTaskRoutePolicy(task({
  jobId: "job:review-invalid", productId: "payment_screenshot_observation", actionId: "accuracy_challenge",
  materialRefs: reviewTask.material_refs.map((material) => material.role === "subject_result"
    ? { ...material, sha256: HASH_B } : material),
  extra: {
    parameters: reviewTask.parameters, subject_task_ref: "task:subject",
    subject_result_ref: "result:subject", subject_result_hash: HASH_A,
    review_policy: "manual-accuracy-challenge.v1",
  },
})), /AGENT_REVIEW_SUBJECT_MATERIAL_INVALID/u);
const renewal = LeaseRenewReceiptSchema.parse({
  schema_version: "xuanxue-ai-lease-renew-receipt.v6", job_id: "job:control-epoch",
  server_now: "2026-08-28T18:00:00.000Z", lease_expires_at: "2026-08-28T18:01:30.000Z",
  renew_after_ms: 20_000,
  control_intent: { schema_version: "xuanxue-ai-control-intent.v6", job_id: "job:control-epoch", control_epoch: 0, intent: "none", reason_code: null },
});
assert.equal(renewal.control_intent.control_epoch, 0);

assert.equal(websiteJobAbsent(executionFailure("failed", "AI_V6_JOB_NOT_FOUND")), true,
  "Website exact job absence must authorize physical cleanup of the local job tree");
assert.equal(websiteJobAbsent(executionFailure("failed", "AI_V6_DEVICE_JOB_NOT_FOUND")), false,
  "a job this device cannot see still exists and must never be purged as deleted");
assert.equal(websiteJobAbsent(executionFailure("failed", "CLOUD_TRANSPORT_UNAVAILABLE")), false,
  "transport failure must never be mistaken for Website job absence");
const admissionVariants = [
  admissionReceipt(),
  admissionReceipt({
    bazi_domain_admission_receipt_hash: HASH_A,
    delivery_manifest_id: "delivery-manifest:1",
    delivery_manifest_hash: HASH_B,
  }),
  admissionReceipt({ review_receipt_hash: HASH_B }),
];
for (const receipt of admissionVariants) {
  const status = await readProductionDeviceJobStatus(deviceStatusWithAdmission(receipt), ADMISSION_JOB_ID);
  assert.deepEqual(status.business_admission_receipt, receipt);
}
const admittedStagedResult = resultFor(task({
  jobId: ADMISSION_JOB_ID, productId: "payment_screenshot_observation", actionId: "observe",
}));
const admittedStagedReceipt = admissionReceiptFor(
  ADMISSION_JOB_ID, admittedStagedResult.result_payload_hash,
);
const admittedStagedStatus = await readProductionDeviceJobStatus(deviceStatusWithAdmission(
  admittedStagedReceipt, ADMISSION_JOB_ID, hashCanonical(admittedStagedResult), admittedStagedResult,
), ADMISSION_JOB_ID);
assert.deepEqual(admittedStagedStatus.business_admission_receipt, admittedStagedReceipt,
  "admitted Website artifacts leave no staged receipts but must allow the same result to complete locally");
assert.deepEqual(admittedStagedStatus.staged_result, admittedStagedResult);
const admittedStatusSession: { request: () => Promise<Record<string, unknown>> } = deviceStatusWithAdmission(
  admittedStagedReceipt, ADMISSION_JOB_ID, hashCanonical(admittedStagedResult), admittedStagedResult,
);
const absentAdmissionStatus = await admittedStatusSession.request();
await assert.rejects(readProductionDeviceJobStatus({
  request: async () => ({ ...absentAdmissionStatus, status: "failed", business_admission_receipt: null }),
} as never, ADMISSION_JOB_ID),
(error: unknown) => typedExecutionFailure(error)?.code === "V6_DEVICE_STAGED_RESULT_AUTHORITY_INVALID",
"a staged result without Website admission still requires its artifact receipts");
for (const receipt of [
  admissionReceipt({ bazi_domain_admission_receipt_hash: HASH_A }),
  admissionReceipt({
    bazi_domain_admission_receipt_hash: HASH_A,
    delivery_manifest_id: "delivery-manifest:1",
    delivery_manifest_hash: HASH_B,
    review_receipt_hash: HASH_A,
  }),
  { ...admissionReceipt(), consumption_hash: HASH_B },
]) {
  await assert.rejects(
    readProductionDeviceJobStatus(deviceStatusWithAdmission(receipt), ADMISSION_JOB_ID),
    (error: unknown) => typedExecutionFailure(error)?.code === "V6_BUSINESS_ADMISSION_RECEIPT_INVALID",
  );
}

const noEligibleReceipt = {
  schema_version: "xuanxue-ai-claim-batch-receipt.v6",
  claim_batch_id: "claim-batch:closed-reasons",
  request_id: "request:closed-reasons",
  request_payload_hash: HASH_A,
  outcome: "NO_ELIGIBLE_JOB",
  jobs: [],
  server_now: "2026-09-03T00:00:00.000Z",
  next_claim_after_ms: 3_000,
  queue_epoch: 1,
  reason_codes: ["NO_UNFINISHED_V6_DEMAND", "RETRY_NOT_BEFORE_PENDING"],
} as const;
assert.deepEqual(ClaimBatchReceiptSchema.parse(noEligibleReceipt).reason_codes,
  noEligibleReceipt.reason_codes);
for (const reason_codes of [
  [],
  ["GLOBAL_QUEUE_EMPTY_OR_INELIGIBLE"],
  ["NO_UNFINISHED_V6_DEMAND", "NO_UNFINISHED_V6_DEMAND"],
  ["RETRY_NOT_BEFORE_PENDING", "NO_UNFINISHED_V6_DEMAND"],
]) assert.throws(() => ClaimBatchReceiptSchema.parse({ ...noEligibleReceipt, reason_codes }));

await exerciseOperationsAndBusinessAdmission(productionTask);

const claimed = claimTask(productionTask);
assert.deepEqual(websiteAgentTaskFromClaim(claimed), productionTask);
assert.equal(claimed.status, "failed");
assert.equal(claimed.grant.accepted_attempt_count, 1);
const structureRejection = {
  receipt_hash: HASH_A, rejected_result_payload_hash: HASH_B,
  reason_codes: ["LOCALIZATION_STRUCTURED_EDITION_STRUCTURE_INVALID", "LOCALIZATION_STRUCTURE_CHANGED"],
  validation_failure: { native_error_code: "LOCALIZATION_STRUCTURE_CHANGED",
    json_pointer: "/excluded_scope/segments" },
} as const;
const revisedClaim = (priorRejection: unknown) => ({
  ...claimed, grant: { ...claimed.grant, result_revision: 2, prior_result_rejection: priorRejection },
});
assert.deepEqual(ClaimedProductionTaskSchema.parse(revisedClaim(structureRejection)).grant.prior_result_rejection,
  structureRejection);
for (const validationFailure of [
  { native_error_code: "LOCALIZATION_STRUCTURE_CHANGED" },
  { ...structureRejection.validation_failure, json_pointer: 7 },
  { ...structureRejection.validation_failure, safety_obligation: "tone_preserved" },
  { ...structureRejection.validation_failure, source_text: "原文" },
]) assert.throws(() => ClaimedProductionTaskSchema.parse(revisedClaim({ ...structureRejection, validation_failure: validationFailure })));
assert.throws(() => ClaimedProductionTaskSchema.parse(revisedClaim({
  rejection_kind: "provider_stopped_empty", receipt_hash: HASH_A, rejected_provider_response_fact_hash: HASH_B,
  reason_codes: ["GPT_RESPONSE_STOPPED_EMPTY"], validation_failure: structureRejection.validation_failure,
})));

await exerciseProductionRuntimeSourceBoundaries();

assert.throws(() => parseJsonEnvelope({
  ok: false, error: {
    code: "HTTP_401_UNAUTHORIZED", message: "unauthorized", status: 401, request_id: "request:unauthorized",
  },
}, 401), (error: unknown) => typedExecutionFailure(error)?.code === "HTTP_401_UNAUTHORIZED");
assert.throws(() => parseJsonEnvelope({ ok: true, data: {} }, 409),
  (error: unknown) => typedExecutionFailure(error)?.code === "AI_PRODUCTION_HTTP_ENVELOPE_STATUS_MISMATCH");
assert.throws(() => parseJsonEnvelope({
  ok: false, error: {
    code: "AI_SESSION_BINDING_MISMATCH", message: "mismatch", status: 503, request_id: "request:mismatch",
  },
}, 409), (error: unknown) => typedExecutionFailure(error)?.code === "AI_PRODUCTION_HTTP_ENVELOPE_STATUS_MISMATCH");
assert.throws(() => parseJsonEnvelope({
  ok: false, error: {
    code: "AI_SESSION_BINDING_MISMATCH", message: "mismatch", status: 409, request_id: "request:mismatch",
  },
}, 200), (error: unknown) => typedExecutionFailure(error)?.code === "AI_PRODUCTION_HTTP_ENVELOPE_STATUS_MISMATCH");

await assert.rejects(
  () => dispatchWebsiteAgentTask(productionTask, () => { throw new Error("CONTEXT_MUST_NOT_BE_CREATED"); }),
  /CONTEXT_MUST_NOT_BE_CREATED/u,
);

await exerciseWorkerSessionRotation();
await exerciseHeartbeatResponseLossRecovery();
await exerciseLeaseRenewRetry();
await exerciseGeneratedImageTransport(productionTask);
await verifyGptDialogMismatchRuntimeContract();
await verifyKnownGptRateLimitRuntimeContract();
await verifyAttemptFailureReadbackRuntimeContract();


process.stdout.write("[ACCEPTANCE][agent-production-runtime] PASS\n");
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-007-V44",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "summary"],
  locator: "acceptance:agent-production-runtime:manifest-owner-fail-closed",
  observedValue: "the unique Runtime ownership inspector accepted the current Runtime-only manifest and rejected injected Mediator and Product ownership mutants",
});
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V73",
  evidenceMode: "exam.state-machine",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:5", "summary"],
  locator: "acceptance:agent-production-runtime:attempt-recovery-state-machine",
  observedValue: "binary task lifecycle durable accept same-attempt recovery lease outbox and typed cross-owner boundaries exercised",
});
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V73",
  evidenceMode: "exam.property",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:5", "summary"],
  locator: "acceptance:agent-production-runtime:transport-properties",
  observedValue: "product-opaque transport rejected malformed identity authority and route inputs while retaining one durable task outbox and recovery chain",
});
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-004-V42",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "summary"],
    locator: `acceptance:agent-production-runtime:business-admission:${evidenceMode}`,
    observedValue: "base Bazi and review receipts validated complete canonical hashes while partial mixed drifted and route-mismatched receipts failed before local completion",
  });
}
