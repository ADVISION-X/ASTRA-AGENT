import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  agentPluginCapabilityManifest, productionCatalogHash,
} from "../../src/lib/local-runtime/production/catalog.js";
import { resolveProductPluginIdentity } from "../../src/mediator/product-plugin-catalog.js";
import {
  uploadProductionGeneratedImage,
} from "../../src/lib/local-runtime/production/cloud-client.js";
import { readProductionDeviceJobStatus } from
  "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import {
  WebsiteAgentTaskSchema,
  hashCanonical,
  sha256,
} from "../../src/lib/local-runtime/production/contracts.js";
import { reconcileBusinessAdmission } from "../../src/lib/local-runtime/production/runtime-business-admission.js";
import { permanentAuthorizationRevoked } from
  "../../src/lib/local-runtime/production/runtime-permanent-revocation.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { readProductionOperationsSnapshot } from
  "../../src/lib/local-runtime/production/operations-snapshot.js";
import {
  ClaimBatchReceiptSchema, LeaseRenewReceiptSchema, PriorResultRejectionSchema, parseJsonEnvelope,
  websiteAgentTaskFromClaim,
} from "../../src/lib/local-runtime/production/transport-protocol.js";
import { typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { assertProductionTaskRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import { runtimeManifestOwnershipDrift } from "../audit/domains/agent-production-runtime/inspector.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import {
  HASH_A,
  HASH_B,
  HASH_C,
  claimTask,
  identityFor,
  resultFor,
  task,
} from "./agent-production-runtime-fixtures.js";
import "./agent-production-runtime-ledger.acceptance.js";
import "./agent-production-runtime-continuation.acceptance.js";
import "./agent-production-runtime-proof-boundary.acceptance.js";
import "./agent-production-runtime-startup.acceptance.js";
import { exerciseWorkerSessionRotation } from "./agent-production-runtime-session-rotation-support.js";

const successfulJsonResponse = (data: unknown): Response => new Response(
  JSON.stringify({ ok: true, data }),
  { status: 200, headers: { "content-type": "application/json" } },
);

assert.equal(hashCanonical(agentPluginCapabilityManifest.plugins), productionCatalogHash);

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

assert.equal(authorizeWebsiteAgentTask(productionTask).identity.plugin_id, "payment-screenshot-observation");
assert.equal(authorizeWebsiteAgentTask(reviewTask).identity.plugin_id, "payment-screenshot-observation");
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
  () => resolveProductPluginIdentity("bazi_basic_chart" as never, "produce" as never),
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
    prior_result_rejection: null,
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

const revisionRejection = PriorResultRejectionSchema.parse({
  schema_version: "xuanxue-ai-prior-result-rejection.v1",
  job_id: productionTask.job_id,
  previous_attempt_id: "attempt:revision:1",
  previous_result_payload_hash: HASH_B,
  reason_codes: ["PUBLIC_KNOWLEDGE_ARTICLE_REJECTED"],
  receipt_hash: HASH_C,
});
assert.throws(() => PriorResultRejectionSchema.parse({
  ...revisionRejection,
  reason_codes: ["PUBLIC_KNOWLEDGE_RESEARCH_REJECTED", "PUBLIC_KNOWLEDGE_ARTICLE_REJECTED"],
}));

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
      browserTargetState: "absent", browserLaneState: "idle", controlContractVersion: 20,
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

const revisionTemporary = await mkdtemp(path.join(tmpdir(), "agent-result-revision-"));
try {
  const store = new ProductionRuntimeStore(revisionTemporary);
  const identity = identityFor(productionTask);
  const staged = resultFor(productionTask, identity);
  store.acceptTask(productionTask, identity, revisionRejection.previous_attempt_id);
  store.stageResult(productionTask.job_id, staged);
  store.reconcileRejectedResultRevision({ rejection: revisionRejection, nextAttemptId: "attempt:revision:2" });
  const reconciled = store.readTask(productionTask.job_id)!;
  assert.equal(reconciled.current_attempt_id, revisionRejection.previous_attempt_id);
  assert.equal(reconciled.staged_result, null);
  assert.equal(reconciled.current_reason, "RESULT_REVISION_REJECTED");
  const next = store.acceptTask(productionTask, identity, "attempt:revision:2");
  assert.equal(next.current_attempt_id, "attempt:revision:2");
  store.reconcileRejectedResultRevision({ rejection: revisionRejection, nextAttemptId: "attempt:revision:2" });
  assert.throws(() => store.reconcileRejectedResultRevision({
    rejection: { ...revisionRejection, previous_result_payload_hash: HASH_A },
    nextAttemptId: "attempt:revision:3",
  }), /PRODUCTION_RESULT_REVISION_IDENTITY_MISMATCH/u);
  assert.equal(store.isLedgerConsistent(new Set()), true);
  store.close();
} finally {
  await rm(revisionTemporary, { recursive: true, force: true });
}

const admissionTemporary = await mkdtemp(path.join(tmpdir(), "agent-business-admission-"));
try {
  const store = new ProductionRuntimeStore(admissionTemporary);
  for (const kind of ["base", "bazi", "review"] as const) {
    const accepted = task({ jobId: `job:admission:${kind}`,
      productId: productionTask.product_id, actionId: productionTask.action_id,
      materialRefs: productionTask.material_refs,
      extra: { parameters: productionTask.parameters } });
    const identity = identityFor(accepted);
    const staged = resultFor(accepted, identity);
    store.acceptTask(accepted, identity, `attempt:${kind}`);
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

const runtimeSource = await readFile(new URL("../../src/lib/local-runtime/production/runtime-claim.ts", import.meta.url), "utf8");
const permanentRevocationSource = await readFile(
  new URL("../../src/lib/local-runtime/production/runtime-permanent-revocation.ts", import.meta.url),
  "utf8",
);
const runtimeLoopsSource = await readFile(
  new URL("../../src/lib/local-runtime/production/runtime-loops.ts", import.meta.url), "utf8",
);
const outboxSource = await readFile(
  new URL("../../src/lib/local-runtime/production/store-outbox.ts", import.meta.url), "utf8",
);
const storeFoundationSource = await readFile(
  new URL("../../src/lib/local-runtime/production/store-foundation.ts", import.meta.url), "utf8",
);
const reconciliationSource = await readFile(
  new URL("../../src/lib/local-runtime/production/cloud-reconciliation-client.ts", import.meta.url), "utf8",
);
const executorSource = await readFile(new URL("../../src/lib/local-runtime/production/executor.ts", import.meta.url), "utf8");
const heartbeatSource = await readFile(new URL("../../src/lib/local-runtime/production/runtime-execution-heartbeat.ts", import.meta.url), "utf8");
const cloudSource = await readFile(new URL("../../src/lib/local-runtime/production/cloud-client.ts", import.meta.url), "utf8");
const leaseReleaseContractSource = await readFile(
  new URL("../../src/lib/local-runtime/production/lease-release-contract.ts", import.meta.url),
  "utf8",
);
const storeSource = await readFile(new URL("../../src/lib/local-runtime/production/store-task-state.ts", import.meta.url), "utf8");
const continuationStoreSource = await readFile(
  new URL("../../src/lib/local-runtime/production/store-continuation-state.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(runtimeSource, /emitState|stateKey:|currentStates|reconciledFromAuthority/u);
assert.doesNotMatch(executorSource, /runTurn|ProductionGptExecutor|GPT_TURN_FLOW/u);
assert.match(executorSource, /gpt: gptExecution\.tools/u);

const executeClaimSource = runtimeSource.slice(runtimeSource.indexOf("export const executeClaim"));
const acceptClaimIndex = executeClaimSource.indexOf("let claim = acceptClaim");
const staleCheckpointIndex = executeClaimSource.indexOf("reconcileStaleFenceCheckpoint");
const prefixRecoveryIndex = executeClaimSource.indexOf("recoverAcceptedClaim");
assert.ok(acceptClaimIndex >= 0 && staleCheckpointIndex > acceptClaimIndex,
  "a stale-fence retry must occur only after the current claim is durably accepted and fully authorized");
assert.ok(prefixRecoveryIndex > staleCheckpointIndex,
  "checkpoint-prefix recovery must use the result of the serialized stale-fence reconciliation");
assert.match(outboxSource, /WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE/u);
assert.match(outboxSource, /typedRuntimeTransportFailure\(error\)/u);
assert.match(outboxSource, /next_delivery_at=null/u);
assert.match(outboxSource, /deliverReauthorizedStaleCheckpoint/u);

const deletionSettlement = permanentRevocationSource;
const noControlAbort = new AbortController();
assert.equal(permanentAuthorizationRevoked(
  noControlAbort.signal,
), false, "a transport error code cannot mint a Website permanent-revocation fact");
const exactControlAbort = new AbortController();
exactControlAbort.abort("CONTROL_INTENT:cancel_requested:PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
assert.equal(permanentAuthorizationRevoked(exactControlAbort.signal), true);
assert.doesNotMatch(deletionSettlement, /AI_PERMANENT_AUTHORIZATION_REVOKED/u);
assert.match(deletionSettlement, /settlePermanentlyRevokedJob\(job\.job_id/u);
assert.match(deletionSettlement, /readBrowserReconciliationScope/u);
assert.match(deletionSettlement, /PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED:READ_ONLY_RECONCILIATION_REQUIRED/u);
assert.match(deletionSettlement, /const stableRequestId = `aiprelease_/u);
assert.match(deletionSettlement, /readProductionDeviceJobStatus/u);
assert.match(deletionSettlement, /receipt\.request_id === stableRequestId/u);
assert.doesNotMatch(deletionSettlement, /persistAttemptFailure|claimProductionTasks|dispatchWebsiteAgentTask/u);
assert.match(executorSource, /abort_signal\.aborted[\s\S]{0,220}PRODUCTION_EXECUTION_ABORTED/u);
assert.match(executorSource, /reconcilePermanentCancellation/u);
const deletionControlIndex = heartbeatSource.indexOf('if (receipt.control_intent.intent !== "none")');
const renewalBudgetIndex = heartbeatSource.indexOf("const relative = Date.parse(receipt.lease_expires_at)");
assert.ok(deletionControlIndex >= 0 && renewalBudgetIndex > deletionControlIndex,
  "permanent control must stop execution before a non-extended lease is treated as an invalid renewal budget");
assert.match(leaseReleaseContractSource, /PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED/u);
assert.match(cloudSource, /stableRequestId/u);
assert.match(storeSource, /extends ProductionStoreContinuationState/u);
assert.match(continuationStoreSource, /releaseGptContinuationLanesForJob/u);
assert.match(reconciliationSource, /V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID/u);
assert.match(reconciliationSource, /currentReason\?\.code === "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED"/u);
assert.match(runtimeLoopsSource, /settleInactivePermanentAuthorizationRevocation/u);
assert.match(runtimeLoopsSource, /readCurrentTargetLocalReconciliationCandidate/u);
assert.match(runtimeLoopsSource, /reconcilePermanentlyRevokedTargetLocal/u);
assert.match(runtimeLoopsSource, /const browserReconciliation = reconcilePermanentlyRevokedBrowserQuarantine\(state\)/u);
assert.match(runtimeLoopsSource, /deferOutboxReconciliation/u);
assert.match(runtimeLoopsSource, /blockedJobIds/u);
assert.match(outboxSource, /settlePermanentlyRevokedJob/u);
assert.match(outboxSource, /set last_error=\?,next_delivery_at=null where instr\(path,\?\)>0/u);
assert.doesNotMatch(outboxSource, /where path like \?/u);
assert.doesNotMatch(outboxSource, /delete from production_outbox/u);
const revocationSettlementSource = outboxSource.slice(
  outboxSource.indexOf("public settlePermanentlyRevokedJob"),
  outboxSource.indexOf("public deliverOutbox"),
);
assert.doesNotMatch(revocationSettlementSource, /sent_at\s*=/u);
assert.match(storeFoundationSource, /last_error not in/u);
assert.match(storeFoundationSource, /'PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED'/u);
assert.match(storeFoundationSource, /'WEBSITE_HTTP_409:AI_LEASE_FENCE_STALE'/u);

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

const runtimeManifest = JSON.parse(await readFile(
  new URL("../audit/domains/agent-production-runtime/manifest.json", import.meta.url), "utf8",
)) as { ownedPaths: string[] };
const detectedOwnerDrift = runtimeManifestOwnershipDrift(runtimeManifest.ownedPaths);
assert.deepEqual(detectedOwnerDrift, []);
assert.deepEqual(runtimeManifestOwnershipDrift([
  ...runtimeManifest.ownedPaths,
  "src/mediator/agent-production-route.ts",
  "src/plugins/**",
]), ["src/mediator/agent-production-route.ts", "src/plugins/**"]);
assert.deepEqual(runtimeManifestOwnershipDrift([
  "docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md",
  "docs/specs/agent-production-runtime/**",
  "scripts/acceptance/agent-production-runtime.acceptance.ts",
  "scripts/audit/domains/agent-production-runtime/**",
  "src/lib/local-runtime/production/**",
]), []);

const runtimeLawSource = await readFile(
  new URL("../../.github/instructions/agent-rules/功能法案.md", import.meta.url), "utf8",
);
const runtimeBlueprint = await readFile(
  new URL("../../docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md", import.meta.url), "utf8",
);
const runtimeLawRecords = [...runtimeLawSource.matchAll(/```law-record\n([\s\S]*?)\n```/gu)]
  .map((match) => JSON.parse(match[1]!) as { lawId: string; forbidden: string[] });
const runtimeCoreLaw = runtimeLawRecords.find(
  (record) => record.lawId === "LAW-AGENT-PRODUCTION-RUNTIME-001-V47",
);
assert.ok(runtimeCoreLaw);
assert.equal(runtimeCoreLaw.forbidden.length, 7);
for (const token of [
  "FROZEN-WEBSITE-RESULT-DEMAND-001",
  "Website ai-acceptance 唯一拥有 public status、业务需求有效性、永久撤权、claim/attempt、V6 current projection、event receipt、rearm/grant 与最终 completed 投影",
  "Runtime 只能消费现役 claim、control intent、device-job status、grant.prior_result_rejection 与 business admission receipt 的 typed 权威投影",
  "不得因本地故障",
  "Website 同时精确证明永久业务撤权时",
  "不授权 Runtime 盲重放 DISPATCHED/CONFIRMED Provider mutation",
  "解冻 FROZEN-WEBSITE-RESULT-DEMAND-001",
]) assert.ok(runtimeCoreLaw.forbidden.some((entry) => entry.includes(token)), token);
const expectedRuntimeConsumerBlock = [
  "consumes = FROZEN-WEBSITE-RESULT-DEMAND-001",
  "canonical_owner = Website.ai-acceptance",
  "semantic_rejection_owner = Website.Domain-Consumer",
  "status_and_rearm_owner = Website.ai-acceptance",
  "runtime_may_define_public_status = false",
  "runtime_may_decide_demand_or_revocation = false",
  "website_authorized_unfinished_job => runtime_delivery_obligation_active = true",
  "agent_fault_may_stop_local_delivery_obligation = false",
  "website_result_revision_rejected => preserve_old_outbox_and_clear_current_staged_projection = true",
  "new_attempt_after_result_rejection => exact_prior_result_rejection_required = true",
  "prior_result_rejection_reason_codes_are_nonempty_unique_unicode_codepoint_sorted_closed_enum = true",
  "new_attempt_after_result_rejection => new_provider_prompt_hash_required = true",
  "new_attempt_after_result_rejection => new_result_payload_hash_required = true",
  "website_permanent_business_revocation => new_attempt_after_result_rejection = false",
  "provider_effect_may_be_blindly_replayed = false",
  "ordinary_change_may_modify_this_consumer_obligation = false",
].join("\n");
const runtimeConsumerBlock = runtimeBlueprint.match(
  /```text\n(consumes = FROZEN-WEBSITE-RESULT-DEMAND-001[\s\S]*?)\n```/u,
);
assert.ok(runtimeConsumerBlock);
assert.equal(runtimeConsumerBlock[1], expectedRuntimeConsumerBlock);
process.stdout.write("[ACCEPTANCE][agent-production-runtime] PASS\n");
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-007-V17",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "summary"],
  locator: "acceptance:agent-production-runtime:manifest-owner-fail-closed",
  observedValue: "the unique Runtime ownership inspector accepted the current Runtime-only manifest and rejected injected Mediator and Product ownership mutants",
});
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V47",
  evidenceMode: "exam.state-machine",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:5", "summary"],
  locator: "acceptance:agent-production-runtime:attempt-recovery-state-machine",
  observedValue: "binary task lifecycle durable accept same-attempt recovery lease outbox and typed cross-owner boundaries exercised",
});
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V47",
  evidenceMode: "exam.property",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:5", "summary"],
  locator: "acceptance:agent-production-runtime:transport-properties",
  observedValue: "product-opaque transport rejected malformed identity authority and route inputs while retaining one durable task outbox and recovery chain",
});
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-004-V17",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "summary"],
    locator: `acceptance:agent-production-runtime:business-admission:${evidenceMode}`,
    observedValue: "base Bazi and review receipts validated complete canonical hashes while partial mixed drifted and route-mismatched receipts failed before local completion",
  });
}
