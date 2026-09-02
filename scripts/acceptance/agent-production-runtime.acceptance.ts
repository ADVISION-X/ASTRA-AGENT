import assert from "../audit/shared/governance-exam-assert.js";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import {
  agentPluginCapabilityManifest, productionCatalogHash, productionPluginCatalog, resolveProductionPlugin,
} from "../../src/lib/local-runtime/production/catalog.js";
import { WebsiteAgentTaskSchema, hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import { LeaseRenewReceiptSchema, parseJsonEnvelope, websiteAgentTaskFromClaim } from "../../src/lib/local-runtime/production/transport-protocol.js";
import { typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { assertProductionTaskRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { HASH_A, HASH_B, claimTask, task } from "./agent-production-runtime-fixtures.js";
import "./agent-production-gpt-browser-lifecycle.acceptance.js";
import "./agent-production-gpt-artifact-recovery.acceptance.js";
import "./agent-production-frontier-cutover.acceptance.js";
import "./agent-production-continuation-restart.acceptance.js";
import "./agent-production-runtime-ledger.acceptance.js";
import "./agent-production-runtime-continuation.acceptance.js";
import "./agent-production-provider-recovery.acceptance.js";
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
const heartbeatSource = await readFile(new URL("../../src/lib/local-runtime/production/runtime-execution-heartbeat.ts", import.meta.url), "utf8");
const cloudSource = await readFile(new URL("../../src/lib/local-runtime/production/cloud-client.ts", import.meta.url), "utf8");
const leaseReleaseContractSource = await readFile(
  new URL("../../src/lib/local-runtime/production/lease-release-contract.ts", import.meta.url),
  "utf8",
);
const storeSource = await readFile(new URL("../../src/lib/local-runtime/production/store-task-state.ts", import.meta.url), "utf8");
assert.equal(existsSync(new URL("../../src/lib/local-runtime/production/production-gpt-executor.ts", import.meta.url)), false);
assert.equal(existsSync(new URL("../../src/lib/local-runtime/production/production-gpt-turn-flow.ts", import.meta.url)), false);
assert.doesNotMatch(runtimeSource, /emitState|stateKey:|currentStates|reconciledFromAuthority/u);
assert.doesNotMatch(executorSource, /runTurn|ProductionGptExecutor|GPT_TURN_FLOW/u);
assert.match(executorSource, /gpt: gptExecution\.tools/u);
assert.match(childToolsSource, /this\.gpt\.execute\(intent/u);
assert.match(childToolsSource, /mutationMode: "readback"/u);
assert.doesNotMatch(childToolsSource, /stepIndex|flowVersion|resumePoint|reconcileOnly/u);

const deletionSettlement = permanentRevocationSource;
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
assert.match(childToolsSource, /mutationMode: "readback"/u);
const deletionControlIndex = heartbeatSource.indexOf('if (receipt.control_intent.intent !== "none")');
const renewalBudgetIndex = heartbeatSource.indexOf("const relative = Date.parse(receipt.lease_expires_at)");
assert.ok(deletionControlIndex >= 0 && renewalBudgetIndex > deletionControlIndex,
  "permanent control must stop execution before a non-extended lease is treated as an invalid renewal budget");
assert.match(leaseReleaseContractSource, /PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED/u);
assert.match(cloudSource, /stableRequestId/u);
assert.match(storeSource, /releaseGptContinuationLanesForJob/u);
assert.match(reconciliationSource, /V6_DEVICE_JOB_CONTROL_AUTHORITY_INVALID/u);
assert.match(reconciliationSource, /currentReason\?\.code === "PUBLIC_KNOWLEDGE_WORK_ORDER_DELETED"/u);
assert.match(runtimeLoopsSource, /settleInactivePermanentAuthorizationRevocation/u);
assert.match(runtimeLoopsSource, /deferOutboxReconciliation/u);
assert.match(runtimeLoopsSource, /blockedJobIds/u);
assert.match(outboxSource, /settlePermanentlyRevokedJob/u);
assert.match(outboxSource, /set last_error=\?,next_delivery_at=null where path like \?/u);
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
for (const plugin of productionPluginCatalog) {
  if (plugin.pluginId === "public-knowledge-article-pipeline") continue;
  const productSource = await readFile(
    new URL(`../../src/plugins/${plugin.pluginId}/flow.ts`, import.meta.url), "utf8",
  );
  assert.doesNotMatch(productSource, /PRODUCT_FLOW_NOT_IMPLEMENTED:/u);
  assert.match(productSource, /context\.gpt\.execute/u);
  assert.match(productSource, /readCallFacts/u);
}

process.stdout.write("[ACCEPTANCE][agent-production-runtime] PASS\n");
emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V28",
  evidenceMode: "exam.state-machine",
  clauses: ["forbidden:10", "forbidden:11", "forbidden:12", "forbidden:13", "forbidden:19", "forbidden:23", "forbidden:24", "forbidden:25", "forbidden:26", "forbidden:29", "forbidden:9", "summary"],
  locator: "acceptance:agent-production-runtime:attempt-recovery-state-machine",
  observedValue: "binary task lifecycle continuation lease outbox and typed failure transitions exercised",
});
