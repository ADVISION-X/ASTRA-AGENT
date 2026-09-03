import assert from "../audit/shared/governance-exam-assert.js";
import { readFile } from "node:fs/promises";

import type { ProductionHash, WebsiteAgentTask } from
  "../../src/lib/local-runtime/production/contracts.js";
import {
  assertProductionTaskRoutePolicy,
  productionRoutePolicies,
  type ProductionRoutePolicy,
} from "../../src/lib/local-runtime/production/route-policy.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const HASH = `sha256:${"a".repeat(64)}` as ProductionHash;
const HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;

const parameterValue = (key: string, route: ProductionRoutePolicy): unknown => {
  const fixed: Readonly<Record<string, unknown>> = {
    evidence_ref_catalog: ["record:1"],
    analysis_kind: "chart_interpretation",
    article_package_contract_version: "public-knowledge-article-package.v1",
    observation_schema_version: "payment-screenshot-observation-v1",
    reflection_contract_version: "scheduled-quality-reflection.v1",
    target_locale: "en-US",
    locale: "zh-CN",
    thread_ref: "continuation:1",
  };
  if (key === "result_schema_version") return route.result_schema_version;
  if (key === "reusable_base_candidate") return null;
  if (Object.hasOwn(fixed, key)) return fixed[key];
  if (key === "resource_kind") {
    return route.product_id === "localization_report_translation" ? "report" : "article";
  }
  if (key === "reusable_base_semantic_digest") return HASH;
  if (key.endsWith("_hash") || key.endsWith("_sha256")) return HASH;
  return `${key}:1`;
};

const taskFor = (route: ProductionRoutePolicy): WebsiteAgentTask => ({
  schema_version: "website-agent-task.v1",
  protocol_version: "xuanxue-ai-production-v6",
  job_id: `job:${route.product_id}:${route.action_id}`,
  source_task_id: `source:${route.product_id}:${route.action_id}`,
  product_id: route.product_id,
  action_id: route.action_id,
  idempotency_key: `idempotency:${route.product_id}:${route.action_id}`,
  request_hash: HASH,
  task_contract_id: "website-agent-task",
  task_contract_version: 1,
  business_identity: {
    owner_ref: "owner:1", subject_ref: "subject:1", authorization_ref: "authorization:1",
  },
  business_context_ref: "context:1",
  business_context_hash: HASH,
  parameters: Object.fromEntries(route.required_parameter_keys.map((key) => [key, parameterValue(key, route)])),
  material_refs: route.material_roles.map((material, ordinal) => ({
    material_id: `material:${ordinal}`,
    ordinal,
    role: material.role,
    display_name: `material-${ordinal}.json`,
    object_ref: material.role === "subject_result" ? "result:subject" : `object:${ordinal}`,
    sha256: HASH,
    bytes: 10,
    media_type: material.media_types[0]!,
    storage_class: material.storage_class,
    owner_scope_hash: material.owner_scope_policy === "required" ? HASH_B : null,
    trust_class: material.trust_class,
    may_issue_instruction: material.may_issue_instruction,
  })),
  result_contract_id: "website-agent-result",
  result_contract_version: 1,
  ...(route.relation_kind === "continuation" ? {
    continuation_ref: "continuation:1",
    parent_task_ref: "task:parent",
    parent_result_ref: "result:parent",
    parent_result_hash: HASH,
  } : {}),
  ...(route.relation_kind === "review" ? {
    subject_task_ref: "task:subject",
    subject_result_ref: "result:subject",
    subject_result_hash: HASH,
    review_policy: route.action_id === "accuracy_challenge"
      ? "manual-accuracy-challenge.v1" as const
      : "scheduled-quality-reflection.v1" as const,
  } : {}),
});

const projection = JSON.parse(await readFile(new URL(
  "../../src/lib/local-runtime/production/website-agent-route-policies.v1.json",
  import.meta.url,
), "utf8")) as Readonly<{
  parameter_types: Readonly<Record<string, unknown>>;
  routes: readonly Readonly<{
    product_id: string;
    action_id: string;
    result_contract?: unknown;
    required_parameter_keys: readonly string[];
  }>[];
}>;

assert.equal(productionRoutePolicies.length, 39);
assert.equal(projection.routes.length, 39);
assert.equal(Object.keys(projection.parameter_types).length, 57);
assert.equal(projection.routes.filter((route) => route.result_contract !== undefined).length, 30);
assert.equal(projection.routes.filter((route) =>
  route.required_parameter_keys.includes("reusable_base_reservation_ref")
  && route.required_parameter_keys.includes("reusable_base_reservation_hash")).length, 2);

const tested = new Set<string>();
for (const route of productionRoutePolicies) {
  const task = taskFor(route);
  assertProductionTaskRoutePolicy(task);
  const firstParameter = route.required_parameter_keys[0]!;
  const invalidValue = Array.isArray(task.parameters[firstParameter]) ? []
    : firstParameter.endsWith("_hash") || firstParameter.endsWith("_sha256") ? "not-a-hash" : "";
  assert.throws(() => assertProductionTaskRoutePolicy({
    ...task,
    parameters: { ...task.parameters, [firstParameter]: invalidValue },
  }), /AGENT_ROUTE_PARAMETER_VALUE_INVALID/u);
  if (route.relation_kind === "review") {
    assert.throws(() => assertProductionTaskRoutePolicy({
      ...task,
      material_refs: task.material_refs.map((material) => material.role === "subject_result"
        ? { ...material, sha256: HASH_B } : material),
    }), /AGENT_REVIEW_SUBJECT_MATERIAL_INVALID/u);
  }
  tested.add(`${route.product_id}\0${route.action_id}`);
}
assert.equal(tested.size, 39);

const sample = taskFor(productionRoutePolicies[0]!);
assert.throws(() => assertProductionTaskRoutePolicy({
  ...sample,
  parameters: { ...sample.parameters, forbidden_extra: true },
}), /AGENT_ROUTE_PARAMETER_SET_INVALID/u);

process.stdout.write("[ACCEPTANCE][agent-route-contract] PASS 39/57/30/2\n");
for (const evidenceMode of ["exam.golden", "exam.property"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-003-V2",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "summary"],
    locator: `acceptance:agent-production-runtime:route-contract:${evidenceMode}`,
    observedValue: "provider-derived route projection accepted exactly 39 routes 57 parameter types 30 result contracts and 2 reservation routes",
  });
}
