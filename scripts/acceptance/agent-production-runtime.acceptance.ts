import assert from "../audit/shared/governance-exam-assert.js";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  agentPluginCapabilityManifest, productionCatalogHash, productionPluginCatalog, resolveProductionPlugin,
} from "../../src/lib/local-runtime/production/catalog.js";
import { readProductionDeviceJobStatus } from
  "../../src/lib/local-runtime/production/cloud-reconciliation-client.js";
import { WebsiteAgentTaskSchema, hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { reconcileBusinessAdmission } from "../../src/lib/local-runtime/production/runtime-claim.js";
import { permanentAuthorizationRevoked } from
  "../../src/lib/local-runtime/production/runtime-permanent-revocation.js";
import { ProductionRuntimeStore } from "../../src/lib/local-runtime/production/store.js";
import { LeaseRenewReceiptSchema, parseJsonEnvelope, websiteAgentTaskFromClaim } from "../../src/lib/local-runtime/production/transport-protocol.js";
import { executionFailure, typedExecutionFailure } from "../../src/lib/execution-failure.js";
import { assertProductionTaskRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import { runtimeManifestOwnershipDrift } from "../audit/domains/agent-production-runtime/inspector.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import {
  HASH_A,
  HASH_B,
  claimTask,
  identityFor,
  resultFor,
  task,
} from "./agent-production-runtime-fixtures.js";
import "./agent-production-runtime-ledger.acceptance.js";
import "./agent-production-runtime-continuation.acceptance.js";
import "./agent-production-runtime-proof-boundary.acceptance.js";
import "./agent-production-runtime-startup.acceptance.js";

assert.equal(productionPluginCatalog.length, 12);
assert.equal(agentPluginCapabilityManifest.plugins.length, 12);
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

assert.equal(authorizeWebsiteAgentTask(productionTask).plugin.pluginId, "payment-screenshot-observation");
assert.equal(authorizeWebsiteAgentTask(reviewTask).plugin.pluginId, "payment-screenshot-observation");
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
assert.throws(() => resolveProductionPlugin("bazi_basic_chart" as never, "produce" as never), /PLUGIN_ROUTE_UNSUPPORTED/u);

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

const admissionTemporary = await mkdtemp(path.join(tmpdir(), "agent-business-admission-"));
try {
  const store = new ProductionRuntimeStore(admissionTemporary);
  for (const input of [
    { productId: "bazi_ai_full_analysis" as const, actionId: "produce" as const, kind: "bazi" as const },
    { productId: "payment_screenshot_observation" as const,
      actionId: "accuracy_challenge" as const, kind: "review" as const },
  ]) {
    const accepted = input.kind === "review" ? reviewTask : task({
      jobId: `job:admission:${input.kind}`, productId: input.productId, actionId: input.actionId,
    });
    const identity = identityFor(accepted);
    const staged = resultFor(accepted, identity);
    store.acceptTask(accepted, identity, `attempt:${input.kind}`);
    store.stageResult(accepted.job_id, staged);
    const baseReceipt = admissionReceiptFor(accepted.job_id, staged.result_payload_hash);
    await assert.rejects(
      reconcileBusinessAdmission({
        store,
        session: deviceStatusWithAdmission(baseReceipt, accepted.job_id, hashCanonical(staged)),
      } as never, store.readTask(accepted.job_id)!),
      (error: unknown) => typedExecutionFailure(error)?.code === "BUSINESS_ADMISSION_RECEIPT_KIND_MISMATCH",
    );
    assert.equal(store.readTask(accepted.job_id)?.status, "failed");
    const typedReceipt = admissionReceiptFor(accepted.job_id, staged.result_payload_hash,
      input.kind === "bazi" ? {
        bazi_domain_admission_receipt_hash: HASH_A,
        delivery_manifest_id: "delivery-manifest:1",
        delivery_manifest_hash: HASH_B,
      } : { review_receipt_hash: HASH_A });
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
const childToolsSource = await readFile(new URL("../../src/lib/local-runtime/production/production-gpt-child-tools.ts", import.meta.url), "utf8");
const atomicGptCallSource = await readFile(
  new URL("../../src/lib/local-runtime/production/production-gpt-atomic-call.ts", import.meta.url),
  "utf8",
);
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
assert.equal(existsSync(new URL("../../src/lib/local-runtime/production/production-gpt-executor.ts", import.meta.url)), false);
assert.equal(existsSync(new URL("../../src/lib/local-runtime/production/production-gpt-turn-flow.ts", import.meta.url)), false);
assert.doesNotMatch(runtimeSource, /emitState|stateKey:|currentStates|reconciledFromAuthority/u);
assert.doesNotMatch(executorSource, /runTurn|ProductionGptExecutor|GPT_TURN_FLOW/u);
assert.match(executorSource, /gpt: gptExecution\.tools/u);
assert.match(childToolsSource, /executeProductionGptAtomicCall\(/u);
assert.match(atomicGptCallSource, /gpt\.execute\(intent/u);
assert.match(atomicGptCallSource, /mutationMode: "readback"/u);
assert.doesNotMatch(childToolsSource, /stepIndex|flowVersion|resumePoint|reconcileOnly/u);

const deletionSettlement = permanentRevocationSource;
const noControlAbort = new AbortController();
assert.equal(permanentAuthorizationRevoked(
  executionFailure("failed", "AI_PERMANENT_AUTHORIZATION_REVOKED"), noControlAbort.signal,
), false, "a transport error code cannot mint a Website permanent-revocation fact");
const exactControlAbort = new AbortController();
exactControlAbort.abort("CONTROL_INTENT:cancel_requested:PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED");
assert.equal(permanentAuthorizationRevoked(new Error("opaque"), exactControlAbort.signal), true);
assert.doesNotMatch(deletionSettlement, /AI_PERMANENT_AUTHORIZATION_REVOKED/u);
assert.match(deletionSettlement, /releaseGptContinuationLanesForJob\(job\.job_id\)/u);
assert.match(deletionSettlement, /readBrowserReconciliationScope/u);
assert.match(deletionSettlement, /PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED:READ_ONLY_RECONCILIATION_REQUIRED/u);
assert.match(deletionSettlement, /const stableRequestId = `aiprelease_/u);
assert.match(deletionSettlement, /readProductionDeviceJobStatus/u);
assert.match(deletionSettlement, /receipt\.request_id === stableRequestId/u);
assert.doesNotMatch(deletionSettlement, /persistAttemptFailure|claimProductionTasks|dispatchWebsiteAgentTask/u);
assert.match(executorSource, /abort_signal\.aborted[\s\S]{0,220}PRODUCTION_EXECUTION_ABORTED/u);
assert.match(executorSource, /reconcilePermanentCancellation/u);
assert.match(childToolsSource, /facts\.mutation\?\.outcome !== "DISPATCHED"/u);
assert.match(childToolsSource, /AbortSignal\.timeout/u);
assert.match(atomicGptCallSource, /mutationMode: "readback"/u);
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
assert.match(storeFoundationSource, /last_error<>'PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED'/u);

assert.throws(() => parseJsonEnvelope({
  ok: false, error: { code: "HTTP_401_UNAUTHORIZED", message: "unauthorized" },
}, 401), (error: unknown) => typedExecutionFailure(error)?.code === "HTTP_401_UNAUTHORIZED");

await assert.rejects(
  () => dispatchWebsiteAgentTask(productionTask, () => { throw new Error("CONTEXT_MUST_NOT_BE_CREATED"); }),
  /CONTEXT_MUST_NOT_BE_CREATED/u,
);
const runtimeManifest = JSON.parse(await readFile(
  new URL("../audit/domains/agent-production-runtime/manifest.json", import.meta.url), "utf8",
)) as { ownedPaths: string[] };
const detectedOwnerDrift = runtimeManifestOwnershipDrift(runtimeManifest.ownedPaths);
assert(detectedOwnerDrift.includes("src/plugins/**"));
assert(detectedOwnerDrift.includes("src/mediator/agent-production-route.ts"));
assert.deepEqual(runtimeManifestOwnershipDrift([
  "docs/blueprints/xuanxue-ai-production/WEBSITE-AGENT-V6-BLUEPRINT.md",
  "docs/specs/agent-production-runtime/**",
  "scripts/acceptance/agent-production-runtime.acceptance.ts",
  "scripts/audit/domains/agent-production-runtime/**",
  "src/lib/local-runtime/production/**",
]), []);
process.stdout.write("[ACCEPTANCE][agent-production-runtime] PASS\n");
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-007-V1",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "summary"],
  locator: "acceptance:agent-production-runtime:manifest-owner-fail-closed",
  observedValue: "the unique Runtime ownership inspector accepted the Runtime-only gold set and exposed the current adjacent-owner overclaim without deleting or reassigning it",
});
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V32",
  evidenceMode: "exam.state-machine",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "summary"],
  locator: "acceptance:agent-production-runtime:attempt-recovery-state-machine",
  observedValue: "binary task lifecycle durable accept same-attempt recovery lease outbox and typed cross-owner boundaries exercised",
});
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V32",
  evidenceMode: "exam.property",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "summary"],
  locator: "acceptance:agent-production-runtime:transport-properties",
  observedValue: "product-opaque transport rejected malformed identity authority and route inputs while retaining one durable task outbox and recovery chain",
});
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-004-V1",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "summary"],
    locator: `acceptance:agent-production-runtime:business-admission:${evidenceMode}`,
    observedValue: "base Bazi and review receipts validated complete canonical hashes while partial mixed drifted and route-mismatched receipts failed before local completion",
  });
}
