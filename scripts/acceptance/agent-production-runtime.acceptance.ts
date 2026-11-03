import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { agentRouteCapabilityManifest, productionCatalogHash } from "../../src/lib/local-runtime/production/catalog.js";
import { claimProductionTasks } from "../../src/lib/local-runtime/production/cloud-client.js";
import { readProductionDeviceJobStatus } from "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { WebsiteAgentTaskSchema, hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { websiteJobAbsent } from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { ClaimBatchReceiptSchema, ClaimedProductionTaskSchema, parseJsonEnvelope, websiteAgentTaskFromClaim } from "../../src/lib/local-runtime/production/transport-protocol.js";
import { typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import { ADMISSION_JOB_ID, HASH_A, HASH_B, admissionReceipt, admissionReceiptFor, claimTask, deviceStatusWithAdmission, resultFor, task } from "./agent-production-runtime-fixtures.js";
import { exerciseOperationsAndBusinessAdmission } from "./agent-production-runtime-business-admission.acceptance-support.js";
import { exerciseWorkerSessionRotation, exerciseHeartbeatResponseLossRecovery } from "./agent-production-runtime-session-rotation-support.js";
import { exerciseLeaseRenewRetry } from "./agent-production-runtime-lease-renew-retry-support.js";
import { exerciseGeneratedImageTransport } from "./agent-production-runtime-generated-image.acceptance-support.js";
import { verifyGptDialogMismatchRuntimeContract, verifyKnownGptRateLimitRuntimeContract } from "./agent-production-runtime-dialog-failure.acceptance-support.js";
import { verifyAttemptFailureReadbackRuntimeContract } from "./agent-production-runtime-browser-failure.acceptance-support.js";
import { exerciseProductionRuntimeSourceBoundaries } from "./agent-production-runtime-recovery-boundary.acceptance-support.js";
import { verifySourceTransportGates } from "./agent-production-runtime-store-schema.acceptance-support.js";
import { runtimeTransportFailure } from "../../src/lib/local-runtime/production/transport-failure.js";
import "./agent-production-runtime-ledger.acceptance.js";
import "./agent-production-runtime-proof-boundary.acceptance.js";
import "./agent-production-runtime-startup.acceptance.js";

const primary = task({ jobId: "job:runtime-wire", productId: "payment_screenshot_observation", actionId: "observe",
  materialRefs: [{ material_id: "material:payment", ordinal: 0, role: "payment_screenshot", display_name: "payment.png",
    object_ref: "object:payment", sha256: HASH_A, bytes: 10, media_type: "image/png", storage_class: "private_owner_scoped",
    owner_scope_hash: HASH_B, trust_class: "user_provided_data", may_issue_instruction: false }],
  extra: { parameters: { observation_schema_version: "payment-screenshot-observation-v1" } } });
assert.equal(hashCanonical(agentRouteCapabilityManifest.routes), productionCatalogHash);
await assert.rejects(claimProductionTasks({} as never, 7), /V6_CLAIM_LIMIT_INVALID/u);
assert.equal(authorizeWebsiteAgentTask(primary).task, primary);
assert.throws(() => WebsiteAgentTaskSchema.parse({ ...primary, plugin_id: "implementation:forbidden" }));
assert.throws(() => WebsiteAgentTaskSchema.parse({ ...primary, material_refs: primary.material_refs.map((material) =>
  ({ ...material, may_issue_instruction: true })) }), /AGENT_MATERIAL_INSTRUCTION_AUTHORITY_INVALID/u);
const longIdentity = task({ jobId: "job:long-identity", productId: primary.product_id, actionId: primary.action_id,
  materialRefs: primary.material_refs.map((material) => ({ ...material, material_id: `material:${"x".repeat(300)}` })),
  extra: { source_task_id: `source:${"x".repeat(290)}`, parameters: primary.parameters } });
assert.equal(claimTask(longIdentity).source_task_id, longIdentity.source_task_id);
assert.equal(resultFor(longIdentity).source_task_id, longIdentity.source_task_id);
assert.deepEqual(websiteAgentTaskFromClaim(claimTask(primary)), primary);
for (const [code, absent] of [["AI_V6_JOB_NOT_FOUND", true], ["AI_V6_DEVICE_JOB_NOT_FOUND", false],
  ["CLOUD_TRANSPORT_UNAVAILABLE", false]] as const) assert.equal(websiteJobAbsent(runtimeTransportFailure(code, 404)), absent);

for (const receipt of [admissionReceipt(), admissionReceipt({ bazi_domain_admission_receipt_hash: HASH_A,
  delivery_manifest_id: "manifest:current", delivery_manifest_hash: HASH_B }), admissionReceipt({ review_receipt_hash: HASH_B })]) {
  const remote = await readProductionDeviceJobStatus(deviceStatusWithAdmission(receipt), ADMISSION_JOB_ID);
  assert.deepEqual(remote.business_admission_receipt, receipt);
}
const result = resultFor(task({ jobId: ADMISSION_JOB_ID, productId: "payment_screenshot_observation", actionId: "observe" }));
const receipt = admissionReceiptFor(ADMISSION_JOB_ID, result.result_payload_hash);
const session: { request: () => Promise<Record<string, unknown>> } = deviceStatusWithAdmission(receipt, ADMISSION_JOB_ID, hashCanonical(result), result);
assert.deepEqual((await readProductionDeviceJobStatus(session as never, ADMISSION_JOB_ID)).staged_result, result);
const remote = await session.request();
await assert.rejects(readProductionDeviceJobStatus({ request: async () => ({ ...remote, status: "failed", terminal_status: null, terminal_payload_hash: null,
  business_admission_receipt: null }) } as never, ADMISSION_JOB_ID),
  (error: unknown) => typedExecutionFailure(error)?.code === "V6_DEVICE_STAGED_RESULT_AUTHORITY_INVALID");
const noDemand = { schema_version: "xuanxue-ai-claim-batch-receipt.v6", claim_batch_id: "batch:empty", request_id: "request:empty",
  request_payload_hash: HASH_A, outcome: "NO_ELIGIBLE_JOB", jobs: [], server_now: "2026-10-07T00:00:00.000Z",
  next_claim_after_ms: 3000, queue_epoch: 1, reason_codes: ["NO_UNFINISHED_V6_DEMAND", "RETRY_NOT_BEFORE_PENDING"] };
assert.deepEqual(ClaimBatchReceiptSchema.parse(noDemand).reason_codes, noDemand.reason_codes);
for (const reason_codes of [[], ["GLOBAL_QUEUE_EMPTY_OR_INELIGIBLE"], ["NO_UNFINISHED_V6_DEMAND", "NO_UNFINISHED_V6_DEMAND"],
  [...noDemand.reason_codes].reverse()]) assert.throws(() => ClaimBatchReceiptSchema.parse({ ...noDemand, reason_codes }));
const sixTasks = Array.from({ length: 6 }, (_, index) =>
  claimTask({ ...primary, job_id: `job:capacity-six:${index}` }));
const sixSession = {
  workerSessionId: "worker:1", workerSessionEpoch: 1, controlContractVersion: 49,
  async requestClaim(requestId: string, limit: number) {
    assert.equal(limit, 6);
    return { ...noDemand, request_id: requestId, outcome: "LEASE_GRANTED", jobs: sixTasks, reason_codes: [] };
  },
};
assert.equal((await claimProductionTasks(sixSession as never, 6, "claim:six")).jobs.length, 6);
for (const jobs of [[...sixTasks, sixTasks[0]], [...sixTasks.slice(0, 5), sixTasks[0]]]) {
  await assert.rejects(claimProductionTasks({ ...sixSession,
    requestClaim: async (requestId: string) => ({ ...noDemand, request_id: requestId,
      outcome: "LEASE_GRANTED", jobs, reason_codes: [] }),
  } as never, 6, "claim:six-invalid"),
  (error: unknown) => typedExecutionFailure(error)?.code === "V6_CLAIM_BATCH_INVALID");
}
const rejection = { receipt_hash: HASH_A, rejected_result_payload_hash: HASH_B,
  reason_codes: ["LOCALIZATION_STRUCTURE_CHANGED"], validation_failure: { native_error_code: "LOCALIZATION_STRUCTURE_CHANGED",
    json_pointer: "/excluded_scope/segments" } };
const revised = (value: unknown) => ({ ...claimTask(primary), grant: { ...claimTask(primary).grant,
  result_revision: 2, prior_result_rejection: value } });
assert.deepEqual(ClaimedProductionTaskSchema.parse(revised(rejection)).grant.prior_result_rejection, rejection);
for (const validation_failure of [{ native_error_code: "LOCALIZATION_STRUCTURE_CHANGED" },
  { ...rejection.validation_failure, json_pointer: 7 }, { ...rejection.validation_failure, source_text: "原文" },
  { ...rejection.validation_failure, safety_obligation: "invented" }]) {
  assert.throws(() => ClaimedProductionTaskSchema.parse(revised({ ...rejection, validation_failure })));
}
assert.throws(() => ClaimedProductionTaskSchema.parse(revised({ rejection_kind: "provider_stopped_empty", receipt_hash: HASH_A,
  rejected_provider_response_fact_hash: HASH_B, reason_codes: ["GPT_RESPONSE_STOPPED_EMPTY"], validation_failure: rejection.validation_failure })));
for (const [status, envelopeStatus] of [[409, 503], [200, 409]] as const) {
  assert.throws(() => parseJsonEnvelope({ ok: false, error: { code: "AI_SESSION_BINDING_MISMATCH", message: "mismatch",
    status: envelopeStatus, request_id: "request:mismatch" } }, status),
    (error: unknown) => typedExecutionFailure(error)?.code === "AI_PRODUCTION_HTTP_ENVELOPE_STATUS_MISMATCH");
}
assert.throws(() => parseJsonEnvelope({ ok: true, data: {} }, 409));
assert.throws(() => parseJsonEnvelope({ ok: false, error: { code: "HTTP_401_UNAUTHORIZED", message: "unauthorized",
  status: 401, request_id: "request:unauthorized" } }, 401),
  (error: unknown) => typedExecutionFailure(error)?.code === "HTTP_401_UNAUTHORIZED");
await assert.rejects(dispatchWebsiteAgentTask(primary, () => { throw new Error("CONTEXT_NOT_CREATED"); }), /CONTEXT_NOT_CREATED/u);
await exerciseOperationsAndBusinessAdmission(primary);
await exerciseWorkerSessionRotation();
await exerciseHeartbeatResponseLossRecovery();
await verifySourceTransportGates();
await exerciseLeaseRenewRetry();
await exerciseGeneratedImageTransport(primary);
await verifyGptDialogMismatchRuntimeContract();
await verifyKnownGptRateLimitRuntimeContract();
await verifyAttemptFailureReadbackRuntimeContract();
await exerciseProductionRuntimeSourceBoundaries();
for (const evidenceMode of ["exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({ lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V83", evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:5", "forbidden:10", "forbidden:11", "summary"],
    locator: `acceptance:agent-production-runtime:runtime-authority:${evidenceMode}`,
    observedValue: "Original durable ledger, immutable failure readback, same-attempt delivery, bounded lease renewal, session rotation and pending Website admission exercised without a second lifecycle." });
}
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({ lawId: "LAW-AGENT-PRODUCTION-RUNTIME-004-V49", evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "summary"], locator: `acceptance:agent-production-runtime:receiving:${evidenceMode}`,
    observedValue: "Original receiving receipts close local delivery before domain consumption; bad or absent receipts preserve original recovery and immutable results." });
}
emitQualityProofObservation({ lawId: "LAW-AGENT-PRODUCTION-RUNTIME-007-V50", evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "summary"], locator: "acceptance:agent-production-runtime:manifest-owner-fail-closed",
  observedValue: "Original ownership and recovery support accepted Runtime primary scope and rejected adjacent Product/Mediator ownership." });
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({ lawId: "LAW-AGENT-PRODUCTION-RUNTIME-006-V50", evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "summary"],
    locator: `acceptance:agent-production-runtime:storage-and-retirement:${evidenceMode}`,
    observedValue: "Original inventory and retirement tests completed: exact ownership and orphan bytes, symlink rejection, recoverable byte preservation, 65 mixed-state jobs and reopen, precise absence, joined late writer and sibling protection." });
}
process.stdout.write("[ACCEPTANCE][agent-production-runtime] Runtime contracts exercised\n");
