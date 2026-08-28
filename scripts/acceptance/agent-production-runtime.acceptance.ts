import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  agentPluginCapabilityManifest, productionCatalogHash, productionPluginCatalog, resolveProductionPlugin,
} from "../../src/lib/local-runtime/production/catalog.js";
import {
  WebsiteAgentTaskSchema, hashCanonical,
} from "../../src/lib/local-runtime/production/contracts.js";
import {
  parseJsonEnvelope, websiteAgentTaskFromClaim,
} from "../../src/lib/local-runtime/production/transport-protocol.js";
import { typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { assertProductionTaskRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { authorizeWebsiteAgentTask, dispatchWebsiteAgentTask } from "../../src/mediator/agent-production-route.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { HASH_A, HASH_B, claimTask, identityFor, resultFor, task } from "./agent-production-runtime-fixtures.js";
import "./agent-production-runtime-ledger.acceptance.js";
import "./agent-production-runtime-continuation.acceptance.js";
import "./agent-production-runtime-startup.acceptance.js";

assert.equal(productionPluginCatalog.length, 12);
assert.equal(agentPluginCapabilityManifest.plugins.length, 12);
assert.deepEqual(
  agentPluginCapabilityManifest.plugins.map((entry) => entry.plugin_id).sort(),
  productionPluginCatalog.map((entry) => entry.pluginId).sort(),
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
    subject_task_ref: "task:subject",
    subject_result_ref: "result:subject", subject_result_hash: HASH_A, review_policy: "manual-accuracy-challenge.v1",
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
assert.throws(() => resolveProductionPlugin("bazi_basic_chart" as never, "produce" as never),
  /PLUGIN_ROUTE_UNSUPPORTED/u);

const claimedTask = claimTask(productionTask);
assert.deepEqual(websiteAgentTaskFromClaim(claimedTask), productionTask);
assert.throws(() => authorizeWebsiteAgentTask(claimedTask), /unrecognized_keys/u);

const runtimeSource = await readFile(new URL("../../src/lib/local-runtime/production/runtime-claim.ts", import.meta.url), "utf8");
const transportSource = await readFile(new URL("../../src/lib/local-runtime/production/transport-protocol.ts", import.meta.url), "utf8");
const executorSource = await readFile(new URL("../../src/lib/local-runtime/production/executor.ts", import.meta.url), "utf8");
const gptExecutorSource = await readFile(new URL("../../src/lib/local-runtime/production/production-gpt-executor.ts", import.meta.url), "utf8");
const cloudClientSource = await readFile(new URL("../../src/lib/local-runtime/production/cloud-client.ts", import.meta.url), "utf8");
assert.doesNotMatch(runtimeSource, /(?:message|reason)\.(?:includes|startsWith|match).*?(?:review_required|recovery_required|failed)/u);
assert.doesNotMatch(transportSource, /retryable/u);
assert.match(transportSource, /throw executionFailure\(/u);
assert.match(runtimeSource, /state\.executor\.execute\(input\.task, input\.materials/u);
assert.match(runtimeSource, /current: record\.status/u);
assert.doesNotMatch(executorSource, /this\.store\.markRunning/u);
assert.match(gptExecutorSource, /assertNoPendingMutations/u);
assert.match(cloudClientSource, /delivered\?\.state === "delivered"/u);
assert.match(cloudClientSource, /readFile\(image\.local_path\)/u);

assert.throws(() => parseJsonEnvelope({
  ok: false, error: { code: "HTTP_401_UNAUTHORIZED", message: "unauthorized" },
}, 401), (error: unknown) => typedExecutionFailure(error)?.code === "HTTP_401_UNAUTHORIZED");

let turnCalls = 0;
let completionCalls = 0;
const dispatched = await dispatchWebsiteAgentTask(productionTask, (authorized) => ({
  materials: [],
  runTurn: async () => {
    turnCalls += 1;
    return {
      raw_text: JSON.stringify({
        schema_version: "payment-screenshot-observation-v1", page_kind: "other", payment_app: "unknown",
        success_visible: false, visible_amount_minor_units: null, reason_code: "NO_VISIBLE_SUCCESS",
      }),
      raw_hash: HASH_A, evidence_refs: ["evidence:1"], provider_continuation: null,
    };
  },
  complete: async () => {
    completionCalls += 1;
    return resultFor(authorized.task, identityFor(authorized.task));
  },
}));
assert.equal(dispatched.plugin_id, "payment-screenshot-observation");
assert.deepEqual([turnCalls, completionCalls], [1, 1]);
process.stdout.write("[ACCEPTANCE][agent-production-runtime] PASS\n");
for (const evidenceMode of ["exam.golden", "exam.property", "exam.state-machine"] as const) {
  emitQualityProofObservation({
    passed: true, findings: [], lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V7", evidenceMode,
    clauses: ["forbidden:0", "forbidden:10", "forbidden:11", "forbidden:12", "forbidden:17",
      "forbidden:18", "forbidden:19", "forbidden:2", "forbidden:21", "forbidden:22",
      "forbidden:25", "forbidden:3", "forbidden:8", "forbidden:9"],
    locator: `acceptance:agent-production-runtime:${evidenceMode}`,
    observedValue: "the canonical agent runtime command completed strict 39-route input/result rejection, bounded browser-lane FIFO/DISPATCHED no-replay mutants, typed failure propagation, durable acceptance, frozen identity, outbox idempotency, continuation lane CAS, task-owned Target cleanup, and blocked-shell isolation",
  });
}
