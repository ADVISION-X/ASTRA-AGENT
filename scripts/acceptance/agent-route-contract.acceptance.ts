import { readFile } from "node:fs/promises";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { assertProductionTaskRoutePolicy, productionRoutePolicies } from "../../src/lib/local-runtime/production/route-policy.js";
import { WorkerObservationV6Schema } from "../../src/lib/local-runtime/production/worker-observation-client.js";
import { buildProductTask, FIXTURE_HASH_B } from "./product-plugin-test-runtime.js";
import { task as runtimeTask } from "./agent-production-runtime-fixtures.js";

const projection = JSON.parse(await readFile(new URL(
  "../../src/lib/local-runtime/production/website-agent-route-policies.v1.json", import.meta.url), "utf8"));
assert.equal(projection.contract_version, 18);
assert.equal(projection.routes.length, 40);
assert.equal(Object.keys(projection.parameter_types).length, 48);
assert.equal(projection.routes.filter((route: Record<string, unknown>) => route.result_contract !== undefined).length, 40);
assert.equal(productionRoutePolicies.length, 40);

const seen = new Set<string>();
for (const route of productionRoutePolicies) {
  const fixture = buildProductTask(route, {
    parameters: Object.fromEntries(route.required_parameter_keys.map((key) => [key, `authorized:${key}`])),
    reviewPolicy: route.action_id === "quality_reflection" ? "scheduled-quality-reflection.v1" : "manual-accuracy-challenge.v1",
  });
  const { request_hash: _requestHash, ...request } = fixture;
  const task = runtimeTask({ jobId: fixture.job_id, productId: fixture.product_id, actionId: fixture.action_id,
    materialRefs: fixture.material_refs, extra: request });
  const identity = `${route.product_id}\0${route.action_id}`;
  assert.equal(seen.has(identity), false);
  seen.add(identity);
  assert.doesNotThrow(() => assertProductionTaskRoutePolicy(task));
  // Website owns parameter values; Runtime owns only their exact wire key set.
  assert.doesNotThrow(() => assertProductionTaskRoutePolicy({ ...task,
    parameters: Object.fromEntries(route.required_parameter_keys.map((key) => [key, null])) }));
  assert.throws(() => assertProductionTaskRoutePolicy({ ...task,
    parameters: { ...task.parameters, unauthorized_key: true } }), /AGENT_ROUTE_PARAMETER_SET_INVALID/u);
  const first = route.required_parameter_keys[0];
  if (first !== undefined) {
    const parameters = { ...task.parameters };
    delete parameters[first];
    assert.throws(() => assertProductionTaskRoutePolicy({ ...task, parameters }), /AGENT_ROUTE_PARAMETER_SET_INVALID/u);
  }
  const materials = [...task.material_refs];
  assert.throws(() => assertProductionTaskRoutePolicy({ ...task, material_refs: materials.slice(1) }));
  assert.throws(() => assertProductionTaskRoutePolicy({ ...task, material_refs: [...materials, materials[0]!] }));
  if (route.relation_kind === "review") {
    assert.throws(() => assertProductionTaskRoutePolicy({ ...task, material_refs: task.material_refs.map((material) =>
      material.role === "subject_result" ? { ...material, sha256: FIXTURE_HASH_B } : material) }), /AGENT_REVIEW_SUBJECT_MATERIAL_INVALID/u);
  }
  if (route.product_id === "localization_static_catalog") {
    const { parent_task_ref, parent_result_ref: _ref, parent_result_hash: _hash, ...root } = task;
    assert.doesNotThrow(() => assertProductionTaskRoutePolicy(root));
    assert.doesNotThrow(() => assertProductionTaskRoutePolicy({ ...root, parameters: { ...root.parameters, target_locale: "zh-HK" } }));
    assert.throws(() => assertProductionTaskRoutePolicy({ ...root, parent_task_ref }), /AGENT_ROUTE_RELATION_KIND_INVALID/u);
  }
  if (route.product_id === "localization_report_translation") {
    assert.throws(() => assertProductionTaskRoutePolicy({ ...task, parent_task_ref: "parent:wrong",
      parent_result_ref: "result:wrong", parent_result_hash: FIXTURE_HASH_B }), /AGENT_ROUTE_RELATION_KIND_INVALID/u);
  }
}
assert.equal(seen.size, 40);
const observation = { schema_version: "xuanxue-ai-worker-observation.v6", observed_at: new Date().toISOString(),
  claim_exclusion_counts: [{ reason_code: "NO_UNFINISHED_V6_DEMAND", count: 1 }], nearest_retry_not_before: null,
  scope_total: 0, scope_truncated: false, jobs: [] };
assert.doesNotThrow(() => WorkerObservationV6Schema.parse(observation));
assert.throws(() => WorkerObservationV6Schema.parse({ ...observation,
  claim_exclusion_counts: [{ reason_code: "GLOBAL_QUEUE_EMPTY_OR_INELIGIBLE", count: 1 }] }));
const unresolvedJob = { job_id: "job:unresolved", product_id: "public_knowledge_article_pipeline", action_id: "produce_article",
  status: "failed", current_reason_code: "ATTEMPT_FAILED", accepted_attempt_count: 1, attempt_id: null,
  next_action_code: "WAIT_NEW_ATTEMPT", next_action_at: new Date(Date.now() + 60_000).toISOString(),
  authority_ref: "ai_production_job_runtime:job:unresolved", business_admission_receipt_hash: null };
assert.doesNotThrow(() => WorkerObservationV6Schema.parse({ ...observation, scope_total: 1, jobs: [unresolvedJob] }));
assert.throws(() => WorkerObservationV6Schema.parse({ ...observation, scope_total: 1, jobs: [{ ...unresolvedJob, next_action_at: null }] }));
for (const evidenceMode of ["exam.golden", "exam.property"] as const) {
  emitQualityProofObservation({ lawId: "LAW-AGENT-PRODUCTION-RUNTIME-003-V46", evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "summary"],
    locator: `acceptance:agent-production-runtime:route-contract:${evidenceMode}`,
    observedValue: "Current v18 projection and all forty routes accepted exact keys/materials/relations, rejected missing/extra wire authority, and retained Website-owned opaque parameter values; generated image transport is additionally exercised by the Runtime acceptance." });
}
process.stdout.write("[ACCEPTANCE][agent-route-contract] v18 40/48/40/0\n");
