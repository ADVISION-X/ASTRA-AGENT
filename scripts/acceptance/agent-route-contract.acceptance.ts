import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import projection from "../../src/lib/local-runtime/production/website-agent-route-policies.v1.json" with { type: "json" };
import { assertProductionTaskRoutePolicy, productionRoutePolicies,
  productionRoutePolicy } from "../../src/lib/local-runtime/production/route-policy.js";
import { productPluginCatalogSnapshot } from "../../src/mediator/product-plugin-catalog.js";
import { WorkerObservationV6Schema } from "../../src/lib/local-runtime/production/worker-observation-client.js";
import { buildProductTask, FIXTURE_HASH } from "./product-plugin-test-runtime.js";

assert.equal(projection.contract_id, "astra.website-agent-task-result");
assert.equal(projection.contract_version, 4);
const identities = (routes: readonly { product_id: string; action_id: string }[]) =>
  routes.map(route => `${route.product_id}\0${route.action_id}`).sort();
assert.deepEqual(identities(productionRoutePolicies), identities(productPluginCatalogSnapshot));
assert.equal(new Set(identities(productionRoutePolicies)).size, productionRoutePolicies.length);
assert.throws(() => productionRoutePolicy("bazi_analysis", "produce"));
assert.throws(() => productionRoutePolicy("astra_paper_research", "unknown_action"));

const parameterExamples: Readonly<Record<string, unknown>> = {
  communication_locale: "zh-TW", manuscript_locale: "en-US",
  observation_schema_version: "payment-screenshot-observation-v1", submission_id: "submission:fixture",
  original_text: "授权原文", input_version: 1, research_tier: "high", tier: "high", purpose: "standard",
  handoff_id: "00000000-0000-4000-8000-000000000001", order_id: "00000000-0000-4000-8000-000000000002",
  project_id: "00000000-0000-4000-8000-000000000003", authorization_id: "00000000-0000-4000-8000-000000000004",
  confirmation_version: 1, confirmation_hash: FIXTURE_HASH, expected_revision: 1, parent_result_hash: FIXTURE_HASH,
  turn_id: "00000000-0000-4000-8000-000000000005", dialogue_input_version: 0,
  dialogue_order_revision: null, dialogue_context_hash: FIXTURE_HASH, question: "原问题",
};

for (const route of productionRoutePolicies) {
  const task = buildProductTask(route, {
    parameters: Object.fromEntries(route.required_parameter_keys.map(key => [key, parameterExamples[key]])),
  });
  assert.doesNotThrow(() => assertProductionTaskRoutePolicy(task));
  for (const key of route.required_parameter_keys) {
    assert.throws(() => assertProductionTaskRoutePolicy({ ...task, parameters: { ...task.parameters, [key]: {} } }),
      /AGENT_ROUTE_PARAMETER_SHAPE_INVALID/u);
  }
  if (route.action_id === "user_dialogue") {
    assert.doesNotThrow(() => assertProductionTaskRoutePolicy({ ...task, parameters: { ...task.parameters, dialogue_order_revision: 1 } }));
    for (const invalid of [{ dialogue_input_version: -1 }, { dialogue_order_revision: 0 }, { dialogue_context_hash: "wrong" }]) {
      assert.throws(() => assertProductionTaskRoutePolicy({ ...task, parameters: { ...task.parameters, ...invalid } }),
        /AGENT_ROUTE_PARAMETER_SHAPE_INVALID/u);
    }
  }
  assert.throws(() => assertProductionTaskRoutePolicy({ ...task, parameters: { ...task.parameters, unauthorized: true } }));
  const incomplete = { ...task.parameters };
  delete incomplete[route.required_parameter_keys[0]!];
  assert.throws(() => assertProductionTaskRoutePolicy({ ...task, parameters: incomplete }));
  assert.throws(() => assertProductionTaskRoutePolicy({ ...task, parent_task_ref: "ungranted-parent" }));
  const required = task.material_refs.findIndex(item => route.material_roles.find(role => role.role === item.role)?.min_count !== 0);
  assert.throws(() => assertProductionTaskRoutePolicy({ ...task,
    material_refs: task.material_refs.filter((_, index) => index !== required).map((item, ordinal) => ({ ...item, ordinal })) }));
  for (const replacement of [{ ordinal: 99 }, { role: "ungranted_material" }, { may_issue_instruction: !task.material_refs[0]!.may_issue_instruction }]) {
    assert.throws(() => assertProductionTaskRoutePolicy({ ...task,
      material_refs: task.material_refs.map((item, index) => index === 0 ? { ...item, ...replacement } : item) }));
  }
}
const briefRoute = productionRoutePolicy("astra_paper_research", "prepare_brief");
const brief = buildProductTask(briefRoute, {
  parameters: Object.fromEntries(briefRoute.required_parameter_keys.map(key => [key, parameterExamples[key]])),
});
const original = brief.material_refs.find(item => item.role === "research_input")!;
const rest = brief.material_refs.filter(item => item.role !== "research_input");
const withOriginals = (count: number) => ({ ...brief,
  material_refs: [...Array.from({ length: count }, (_, part) => ({ ...original,
    material_id: `${brief.source_task_id}:research_input:${part}` })), ...rest].map((item, ordinal) => ({ ...item, ordinal })) });
for (const count of [0, 1, 63]) assert.doesNotThrow(() => assertProductionTaskRoutePolicy(withOriginals(count)));
assert.throws(() => assertProductionTaskRoutePolicy(withOriginals(64)));
const wrongPart = withOriginals(2);
assert.throws(() => assertProductionTaskRoutePolicy({ ...wrongPart,
  material_refs: wrongPart.material_refs.map((item, index) => index === 1 ? { ...item, material_id: original.material_id } : item) }));

const observed = { schema_version: "xuanxue-ai-worker-observation.v6", observed_at: new Date().toISOString(),
  claim_exclusion_counts: [{ reason_code: "NO_UNFINISHED_V6_DEMAND", count: 1 }], nearest_retry_not_before: null,
  scope_total: 0, scope_truncated: false, jobs: [] };
assert.doesNotThrow(() => WorkerObservationV6Schema.parse(observed));
assert.throws(() => WorkerObservationV6Schema.parse({ ...observed,
  claim_exclusion_counts: [{ reason_code: "GLOBAL_QUEUE_EMPTY_OR_INELIGIBLE", count: 1 }] }));
const waiting = { job_id: "job:waiting", product_id: "astra_paper_research", action_id: "build_evidence", status: "failed",
  current_reason_code: "ATTEMPT_FAILED", accepted_attempt_count: 1, attempt_id: null, next_action_code: "WAIT_NEW_ATTEMPT",
  next_action_at: new Date(Date.now() + 60_000).toISOString(), authority_ref: "ai_production_job_runtime:job:waiting",
  business_admission_receipt_hash: null };
assert.doesNotThrow(() => WorkerObservationV6Schema.parse({ ...observed, scope_total: 1, jobs: [waiting] }));
assert.throws(() => WorkerObservationV6Schema.parse({ ...observed, scope_total: 1, jobs: [{ ...waiting, next_action_at: null }] }));
for (const evidenceMode of ["exam.golden", "exam.property"] as const) emitQualityProofObservation({
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-003-V56", evidenceMode,
  clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "forbidden:4", "summary"],
  locator: `acceptance:agent-production-runtime:route-contract:${evidenceMode}`,
  observedValue: "ASTRA provider and Catalog route sets agree; exact keys, ordered roles, zero-input brief, private scope, repeatable identities and bounded material count are exercised. File delivery remains a separate Work proof.",
});
process.stdout.write("[ACCEPTANCE][agent-route-contract] ASTRA provider projection\n");
