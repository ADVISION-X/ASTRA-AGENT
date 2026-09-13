import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  agentRouteCapabilityManifest, productionCatalogHash,
} from "../../src/lib/local-runtime/production/catalog.js";
import { assertProductRouteSupported } from "../../src/mediator/product-plugin-catalog.js";
import {
  claimProductionTasks,
  uploadProductionGeneratedImage,
} from "../../src/lib/local-runtime/production/cloud-client.js";
import { PRODUCTION_BUSINESS_CAPACITY_TOTAL } from
  "../../src/lib/local-runtime/production/control-contract-dependency.js";
import { readProductionDeviceJobStatus } from
  "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import {
  WebsiteAgentTaskSchema,
  hashCanonical,
  sha256,
} from "../../src/lib/local-runtime/production/contracts.js";
import {
  purgeDeletedJob,
  reconcileBusinessAdmission,
  websiteJobAbsent,
} from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { businessInFlightCount } from "../../src/lib/local-runtime/production/runtime-loops.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { readProductionOperationsSnapshot } from
  "../../src/lib/local-runtime/production/operations-snapshot.js";
import {
  ClaimBatchReceiptSchema, LeaseRenewReceiptSchema, parseJsonEnvelope,
  websiteAgentTaskFromClaim,
} from "../../src/lib/local-runtime/production/transport-protocol.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { assertProductionTaskRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import {
  HASH_A,
  HASH_B,
  HASH_C,
  claimTask,
  resultFor,
  task,
} from "./agent-production-runtime-fixtures.js";
import "./agent-production-runtime-ledger.acceptance.js";
import "./agent-production-runtime-proof-boundary.acceptance.js";
import "./agent-production-runtime-startup.acceptance.js";
import { exerciseWorkerSessionRotation } from "./agent-production-runtime-session-rotation-support.js";
import { exerciseProductionRuntimeSourceBoundaries } from
  "./agent-production-runtime-recovery-boundary.acceptance-support.js";
const successfulJsonResponse = (data: unknown): Response => new Response(
  JSON.stringify({ ok: true, data }),
  { status: 200, headers: { "content-type": "application/json" } },
);
assert.equal(hashCanonical(agentRouteCapabilityManifest.routes), productionCatalogHash);
assert.equal(PRODUCTION_BUSINESS_CAPACITY_TOTAL, 1);
await assert.rejects(
  claimProductionTasks({} as never, 2),
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
assert.throws(
  () => assertProductRouteSupported("bazi_basic_chart" as never, "produce" as never),
  /PLUGIN_ROUTE_UNSUPPORTED/u,
);

const renewal = LeaseRenewReceiptSchema.parse({
  schema_version: "xuanxue-ai-lease-renew-receipt.v6", job_id: "job:control-epoch",
  server_now: "2026-08-28T18:00:00.000Z", lease_expires_at: "2026-08-28T18:01:30.000Z",
  renew_after_ms: 20_000,
  control_intent: { schema_version: "xuanxue-ai-control-intent.v6", job_id: "job:control-epoch", control_epoch: 0, intent: "none", reason_code: null },
});
assert.equal(renewal.control_intent.control_epoch, 0);

const admissionJobId = "job:business-admission";
const admissionResultHash = HASH_A;
const admissionReceiptFor = (
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
const admissionReceipt = (extra: Readonly<Record<string, unknown>> = {}) =>
  admissionReceiptFor(admissionJobId, admissionResultHash, extra);
const deviceStatusWithAdmission = (
  receipt: unknown,
  jobId = admissionJobId,
  terminalPayloadHash: string = HASH_B,
) => ({
  request: async () => ({
    schema_version: "xuanxue-ai-device-job-status.v6",
    job_id: jobId,
    status: "completed",
    current_reason: null,
    control_intent: {
      schema_version: "xuanxue-ai-control-intent.v6", job_id: jobId,
      control_epoch: 0, intent: "none", reason_code: null,
    },
    terminal_status: "completed",
    terminal_payload_hash: terminalPayloadHash,
    business_admission_receipt: receipt,
    business_consumer_error: null,
    accepted_attempt_count: 1,
    write_receipts: [],
  }),
}) as never;
const deviceStatusWithoutAdmission = (jobId: string, deleted = false) => ({
  request: async () => ({
    schema_version: "xuanxue-ai-device-job-status.v6",
    job_id: jobId,
    status: "failed",
    current_reason: deleted ? { code: "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" } : null,
    control_intent: {
      schema_version: "xuanxue-ai-control-intent.v6", job_id: jobId,
      control_epoch: deleted ? 1 : 0, intent: deleted ? "cancel_requested" : "none",
      reason_code: deleted ? "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED" : null,
    },
    terminal_status: null,
    terminal_payload_hash: null,
    business_admission_receipt: null,
    business_consumer_error: null,
    accepted_attempt_count: 1,
    write_receipts: [],
  }),
}) as never;
assert.equal(websiteJobAbsent(executionFailure("failed", "AI_V6_DEVICE_JOB_NOT_FOUND")), true,
  "a Website device-status 404 must authorize physical cleanup of the local job tree");
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
  const status = await readProductionDeviceJobStatus(deviceStatusWithAdmission(receipt), admissionJobId);
  assert.deepEqual(status.business_admission_receipt, receipt);
}
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
    readProductionDeviceJobStatus(deviceStatusWithAdmission(receipt), admissionJobId),
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

const operationsTemporary = await mkdtemp(path.join(tmpdir(), "agent-operations-snapshot-"));
try {
  const snapshot = await readProductionOperationsSnapshot({
    dataDir: operationsTemporary,
    session: {
      workerSessionId: "session:observation",
      async request() {
        return {
          schema_version: "xuanxue-ai-worker-observation.v6",
          observed_at: "2026-09-03T00:00:00.000Z",
          claim_exclusion_counts: [{ reason_code: "NO_UNFINISHED_V6_DEMAND", count: 1 }],
          nearest_retry_not_before: null,
          scope_total: 0,
          scope_truncated: false,
          jobs: [],
        };
      },
    } as never,
    store: {
      outboxAuthorities: () => [],
    } as never,
    browser: {
      hasBrowserMutationForJob: () => false,
      hasUnresolvedBrowserMutation: () => false,
    } as never,
    health: () => ({
      shellState: "ready", cloudState: "ready", browserState: "ready", executionState: "ready",
      claimAdmissionState: "eligible", logSinkState: "ready", browserAuthorityState: "present",
      browserTargetState: "absent", browserLaneState: "idle", controlContractVersion: 21,
      catalogHash: HASH_A, activeCount: 0, pendingOutboxCount: 0, lastSuccessfulHeartbeatAt: null,
      lastErrorCode: null, lastErrorReason: null, checkedAt: "2026-09-03T00:00:00.000Z",
    }),
    jobId: undefined,
  });
  assert.equal(snapshot.rows.find((entry) => entry.axis === "runtime_log_sink")?.current_value, "ready");
  assert.equal(snapshot.rows.some((entry) => ["agent_task", "lease_fence", "checkpoint"].includes(entry.axis)), false);
  assert.equal(snapshot.rows.find((entry) => entry.axis === "runtime_log_evidence")?.completeness,
    "SOURCE_UNAVAILABLE");
  assert.equal(snapshot.rows.find((entry) => entry.axis === "outbox")?.freshness.kind, "snapshot");
} finally {
  await rm(operationsTemporary, { recursive: true, force: true });
}

const admissionTemporary = await mkdtemp(path.join(tmpdir(), "agent-business-admission-"));
try {
  const store = new ProductionRuntimeStore(admissionTemporary);
  for (const kind of ["base", "bazi", "review"] as const) {
    const accepted = task({ jobId: `job:admission:${kind}`,
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs,
      extra: { parameters: productionTask.parameters } });
    const staged = resultFor(accepted);
    store.acceptTask(accepted, `attempt:${kind}`);
    store.stageResult(accepted.job_id, staged);
    const typedReceipt = admissionReceiptFor(accepted.job_id, staged.result_payload_hash,
      kind === "bazi" ? {
        bazi_domain_admission_receipt_hash: HASH_A,
        delivery_manifest_id: "delivery-manifest:1",
        delivery_manifest_hash: HASH_B,
      } : kind === "review" ? { review_receipt_hash: HASH_A } : {});
    assert.equal(await reconcileBusinessAdmission({
      store,
      session: deviceStatusWithAdmission(typedReceipt, accepted.job_id, hashCanonical(staged)),
    } as never, store.readTask(accepted.job_id)!), "completed");
    assert.equal(store.readTask(accepted.job_id)?.status, "completed");
  }
  const pending = task({ jobId: "job:admission:pending",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  const pendingResult = resultFor(pending);
  store.acceptTask(pending, "attempt:pending");
  store.stageResult(pending.job_id, pendingResult);
  assert.equal(await reconcileBusinessAdmission({
    store, session: deviceStatusWithoutAdmission(pending.job_id),
  } as never, store.readTask(pending.job_id)!), "pending");
  assert.deepEqual(store.readTask(pending.job_id)?.staged_result, pendingResult,
    "absence of Website admission must preserve the staged result and await Website authority");
  assert.equal(store.readTask(pending.job_id)?.current_reason, "BUSINESS_ADMISSION_PENDING");
  assert.equal(businessInFlightCount({ active: new Map(), store } as never), 1,
    "an admission-pending job must retain the only business slot after execution settles");
  assert.equal(businessInFlightCount({ active: new Map([[pending.job_id, Promise.resolve()]]), store } as never), 1,
    "active and admission-pending views of the same job must count once");
  assert.equal(await reconcileBusinessAdmission({
    store, session: deviceStatusWithoutAdmission(pending.job_id, true), activeAbort: new Map(),
  } as never, store.readTask(pending.job_id)!), "pending");
  assert.equal(store.readTask(pending.job_id)?.current_reason, "BUSINESS_ADMISSION_PENDING",
    "cancel_requested is not physical Website absence and cannot authorize local deletion");
  let browserPurges = 0, evidencePurges = 0;
  await purgeDeletedJob({ store, dataDir: admissionTemporary,
    browserAuthority: { purgeBrowserJob: () => { browserPurges += 1; } },
    evidenceStore: { deleteArtifactsForMission: async () => { evidencePurges += 1; } },
  } as never, pending.job_id);
  assert.equal(store.readTask(pending.job_id), null);
  assert.equal(browserPurges, 1);
  assert.equal(evidencePurges, 1);
  assert.equal(store.pendingBusinessAdmissions().some((row) => row.task.job_id === pending.job_id), false,
    "physical Website absence must remove the existing task and stop admission polling");
  const retryable = task({ jobId: "job:admission:purge-retry",
    productId: productionTask.product_id, actionId: productionTask.action_id,
    materialRefs: productionTask.material_refs,
    extra: { parameters: productionTask.parameters } });
  store.acceptTask(retryable, "attempt:purge-retry");
  store.stageResult(retryable.job_id, resultFor(retryable));
  await assert.rejects(purgeDeletedJob({ store, dataDir: admissionTemporary,
    browserAuthority: { purgeBrowserJob: () => undefined },
    evidenceStore: { deleteArtifactsForMission: async () => { throw new Error("FORENSICS_PURGE_FAILED"); } },
  } as never, retryable.job_id), /PRODUCTION_JOB_PURGE_FAILED/u);
  assert.notEqual(store.readTask(retryable.job_id), null,
    "a partial purge must retain the task authority so the same deletion can retry");
  await purgeDeletedJob({ store, dataDir: admissionTemporary,
    browserAuthority: { purgeBrowserJob: () => undefined },
    evidenceStore: { deleteArtifactsForMission: async () => undefined },
  } as never, retryable.job_id);
  assert.equal(store.readTask(retryable.job_id), null);
  store.close();
} finally {
  await rm(admissionTemporary, { recursive: true, force: true });
}

const imageTemporary = await mkdtemp(path.join(tmpdir(), "agent-generated-image-"));
const imageStore = new ProductionRuntimeStore(imageTemporary);
const imageFetch = globalThis.fetch;
let physicalImageUploads = 0;
try {
  const webpBytes = new TextEncoder().encode("fixture-webp");
  const originalBytes = new TextEncoder().encode("fixture-original");
  const image = Object.freeze({
    artifact_id: "image:fixture",
    webp_bytes: webpBytes,
    original_bytes: originalBytes,
    sha256: sha256(webpBytes),
    original_sha256: sha256(originalBytes),
    bytes: webpBytes.byteLength,
    media_type: "image/webp" as const,
    width: 1200 as const,
    height: 630 as const,
  });
  globalThis.fetch = (async (input) => {
    physicalImageUploads += 1;
    const uploadArtifactId = decodeURIComponent(new URL(String(input)).pathname.split("/").at(-1)!);
    return successfulJsonResponse({
      schema_version: "xuanxue-ai-material-receipt.v6",
      artifact_id: uploadArtifactId,
      role: "generated_image",
      object_ref: "object:image:fixture",
      sha256: image.sha256,
      byte_length: image.bytes,
      media_type: "image/webp",
      state: "staged",
      receipt_hash: HASH_C,
    });
  }) as typeof globalThis.fetch;
  const imageJob = claimTask(productionTask);
  const imageSession = {
    device: { server_base_url: "https://production.invalid" },
    authorizationHeaders: async (headers: Record<string, string>) => headers,
  };
  const first = await uploadProductionGeneratedImage(imageSession as never, imageStore, imageJob, image);
  const repeated = await uploadProductionGeneratedImage(imageSession as never, imageStore, imageJob, image);
  assert.equal(physicalImageUploads, 1, "the generated image transport must be physically delivered once");
  assert.deepEqual(repeated.receipt, first.receipt);
  assert.equal(first.receipt.object_ref, "object:image:fixture");
  const secondBytes = new TextEncoder().encode("fixture-webp-second");
  const secondImage = Object.freeze({
    ...image,
    artifact_id: "image:fixture-second",
    webp_bytes: secondBytes,
    sha256: sha256(secondBytes),
    bytes: secondBytes.byteLength,
  });
  globalThis.fetch = (async () => {
    physicalImageUploads += 1;
    return successfulJsonResponse({
      schema_version: "xuanxue-ai-material-receipt.v6",
      artifact_id: "image:wrong",
      role: "generated_image",
      object_ref: "object:image:wrong",
      sha256: secondImage.sha256,
      byte_length: secondImage.bytes,
      media_type: "image/webp",
      state: "staged",
      receipt_hash: HASH_C,
    });
  }) as typeof globalThis.fetch;
  await assert.rejects(
    uploadProductionGeneratedImage(imageSession as never, imageStore, imageJob, secondImage),
    (error: unknown) => typedExecutionFailure(error)?.code === "GENERATED_IMAGE_WEBSITE_RECEIPT_MISMATCH",
    "an artifact receipt for a different image must not terminalize the existing Outbox intent",
  );
} finally {
  globalThis.fetch = imageFetch;
  imageStore.close();
  await rm(imageTemporary, { recursive: true, force: true });
}

const claimed = claimTask(productionTask);
assert.deepEqual(websiteAgentTaskFromClaim(claimed), productionTask);
assert.equal(claimed.status, "failed");
assert.equal(claimed.grant.accepted_attempt_count, 1);

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

process.stdout.write("[ACCEPTANCE][agent-production-runtime] PASS\n");
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-007-V29",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "summary"],
  locator: "acceptance:agent-production-runtime:manifest-owner-fail-closed",
  observedValue: "the unique Runtime ownership inspector accepted the current Runtime-only manifest and rejected injected Mediator and Product ownership mutants",
});
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V56",
  evidenceMode: "exam.state-machine",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:5", "summary"],
  locator: "acceptance:agent-production-runtime:attempt-recovery-state-machine",
  observedValue: "binary task lifecycle durable accept same-attempt recovery lease outbox and typed cross-owner boundaries exercised",
});
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V56",
  evidenceMode: "exam.property",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:5", "summary"],
  locator: "acceptance:agent-production-runtime:transport-properties",
  observedValue: "product-opaque transport rejected malformed identity authority and route inputs while retaining one durable task outbox and recovery chain",
});
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-004-V27",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "summary"],
    locator: `acceptance:agent-production-runtime:business-admission:${evidenceMode}`,
    observedValue: "base Bazi and review receipts validated complete canonical hashes while partial mixed drifted and route-mismatched receipts failed before local completion",
  });
}
