import { readFile } from "node:fs/promises";
import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { assertProductionTaskRoutePolicy, productionRoutePolicies } from "../../src/lib/local-runtime/production/route-policy.js";
import { WorkerObservationV6Schema } from "../../src/lib/local-runtime/production/worker-observation-client.js";
import { buildProductTask, FIXTURE_HASH_B } from "./product-plugin-test-runtime.js";
import { task as runtimeTask } from "./agent-production-runtime-fixtures.js";

const projection = JSON.parse(await readFile(new URL(
  "../../src/lib/local-runtime/production/website-agent-route-policies.v1.json", import.meta.url), "utf8"));
assert.equal(projection.contract_version, 23);
assert.equal(projection.routes.length, 43);
assert.equal(Object.keys(projection.parameter_types).length, 43);
assert.equal(projection.routes.filter((route: Record<string, unknown>) => route.result_contract !== undefined).length, 43);
assert.equal(productionRoutePolicies.length, 43);

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
assert.equal(seen.size, 43);
const localizationPrimaries = productionRoutePolicies.filter(route =>
  ["report_translation", "article_translation", "produce_locale_catalog"].includes(route.action_id));
assert.equal(localizationPrimaries.length, 3);
for (const route of localizationPrimaries) {
  assert.deepEqual(route.material_roles.map(role => [role.role, role.media_types, role.trust_class, role.may_issue_instruction]), [
    ["localization_reference_archive", ["application/zip"], "locked_fact", false],
    ["localization_work_archive", ["application/zip"], "locked_fact", false],
  ]);
  const base = buildProductTask(route, { parameters: Object.fromEntries(route.required_parameter_keys.map(key => [key, "authorized"])) });
  assert.throws(() => assertProductionTaskRoutePolicy({ ...base, material_refs: base.material_refs.map((entry, index) =>
    index ? entry : { ...entry, role: "static_catalog_input", media_type: "application/json" }) }));
}
for (const route of productionRoutePolicies.filter(route => route.material_roles.some(role => role.repeatable))) {
  const base = buildProductTask(route, { parameters: Object.fromEntries(route.required_parameter_keys.map(key => [key, "authorized"])) });
  const grouped = (counts: readonly number[]) => {
    let group = 0;
    const material_refs = route.material_roles.flatMap((role, index) => Array.from({
      length: role.repeatable ? counts[group++]! : 1,
    }, (_, part) => ({ ...base.material_refs[index]!,
      material_id: role.repeatable ? `${base.source_task_id}:${role.role}:${part}` : base.material_refs[index]!.material_id,
      display_name: `group-${index}-part-${part}`,
    }))).map((entry, ordinal) => ({ ...entry, ordinal }));
    return { ...base, material_refs };
  };
  for (const counts of [[1, 1], [2, 3], [31, 32]]) assert.doesNotThrow(() => assertProductionTaskRoutePolicy(grouped(counts)));
  for (const counts of [[0, 1], [1, 0], [32, 32]]) assert.throws(() => assertProductionTaskRoutePolicy(grouped(counts)));
  const full = grouped([2, 3]);
  for (const replacement of [{ material_id: "foreign-task:role:0" }, { material_id: `${base.source_task_id}:${full.material_refs[1]!.role}:1` },
    { ordinal: 99 }, { owner_scope_hash: FIXTURE_HASH_B }, { trust_class: "instruction" as const }, { may_issue_instruction: true }]) {
    assert.throws(() => assertProductionTaskRoutePolicy({ ...full, material_refs: full.material_refs.map((entry, index) =>
      index === 1 ? { ...entry, ...replacement } : entry) }));
  }
  const interleaved = [...full.material_refs];
  [interleaved[2], interleaved[3]] = [interleaved[3]!, interleaved[2]!];
  assert.throws(() => assertProductionTaskRoutePolicy({ ...full,
    material_refs: interleaved.map((entry, ordinal) => ({ ...entry, ordinal })) }));
  assert.throws(() => assertProductionTaskRoutePolicy({ ...full, parent_task_ref: "foreign" }));
}
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
  emitQualityProofObservation({ lawId: "LAW-AGENT-PRODUCTION-RUNTIME-003-V51", evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "summary"],
    locator: `acceptance:agent-production-runtime:route-contract:${evidenceMode}`,
    observedValue: "Current v23 projection and all forty-three routes accepted exact keys/materials/relations, rejected missing/extra wire authority, and retained Website-owned opaque parameter values; generated image transport is additionally exercised by the Runtime acceptance." });
}
process.stdout.write("[ACCEPTANCE][agent-route-contract] v23 43/43/43/0\n");
