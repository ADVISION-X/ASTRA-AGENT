import { governanceAssert as assert } from "../audit/shared/governance-exam-assert.js";
import { readFile } from "node:fs/promises";

import type { ProductionHash, WebsiteAgentTask } from
  "../../src/lib/local-runtime/production/contracts.js";
import {
  assertProductionTaskRoutePolicy,
  productionRoutePolicies,
  type ProductionRoutePolicy,
} from "../../src/lib/local-runtime/production/route-policy.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import { WorkerObservationV6Schema } from "../../src/lib/local-runtime/production/worker-observation-client.js";
import { assertProductRouteSupported } from "../../src/mediator/product-plugin-catalog.js";

const HASH = `sha256:${"a".repeat(64)}` as ProductionHash;
const HASH_B = `sha256:${"b".repeat(64)}` as ProductionHash;

const parameterValue = (key: string): unknown => `website-authorized:${key}`;

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
  parameters: Object.fromEntries(route.required_parameter_keys.map((key) => [key, parameterValue(key)])),
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
  ...(route.relation_kind === "followup" || route.relation_kind === "provider_continuation" ? {
    parent_task_ref: "task:parent",
    parent_result_ref: "result:parent",
    parent_result_hash: HASH,
  } : {}),
  ...(route.relation_kind === "review" ? {
    subject_task_ref: "task:subject",
    subject_result_ref: "result:subject",
    subject_result_hash: HASH,
    review_policy: "website-authorized-review-policy",
  } : {}),
});

const projection = JSON.parse(await readFile(new URL(
  "../../src/lib/local-runtime/production/website-agent-route-policies.v1.json",
  import.meta.url,
), "utf8")) as Readonly<{
  contract_version: number;
  parameter_types: Readonly<Record<string, unknown>>;
  routes: readonly Readonly<{
    product_id: string;
    action_id: string;
    result_contract?: Readonly<{ image?: Readonly<{
      exact_fields?: readonly string[];
      field_types?: Readonly<{ integer?: readonly string[] }>;
      integer_minimums?: Readonly<Record<string, number>>;
      mime_type?: string;
      width?: unknown;
      height?: unknown;
    }> }>;
    required_parameter_keys: readonly string[];
  }>[];
}>;

assert.equal(productionRoutePolicies.length, 40);
assert.equal(projection.contract_version, 13);
assert.equal(projection.routes.length, 40);
assert.equal(Object.keys(projection.parameter_types).length, 46);
assert.equal(projection.routes.filter((route) => route.result_contract !== undefined).length, 33);
const articleImage = projection.routes.find((route) =>
  route.product_id === "public_knowledge_article_pipeline" && route.action_id === "produce_article")
  ?.result_contract?.image;
assert.deepEqual(articleImage?.exact_fields, [
  "schema_version", "artifact_id", "object_ref", "sha256", "receipt_hash",
  "bytes", "mime_type", "width", "height",
]);
assert.deepEqual(articleImage?.field_types?.integer, ["bytes", "width", "height"]);
assert.deepEqual(articleImage?.integer_minimums, { bytes: 1 });
assert.equal(articleImage?.mime_type, "image/webp");
assert.equal(Object.hasOwn(articleImage ?? {}, "width"), false);
assert.equal(Object.hasOwn(articleImage ?? {}, "height"), false);

const tested = new Set<string>();
for (const route of productionRoutePolicies) {
  const task = taskFor(route);
  assertProductionTaskRoutePolicy(task);
  const firstParameter = route.required_parameter_keys[0]!;
  const websiteAuthorizedValue = null;
  assert.doesNotThrow(() => assertProductionTaskRoutePolicy({
    ...task,
    parameters: { ...task.parameters, [firstParameter]: websiteAuthorizedValue },
  }));
  if (route.relation_kind === "review") {
    assert.throws(() => assertProductionTaskRoutePolicy({
      ...task,
      material_refs: task.material_refs.map((material) => material.role === "subject_result"
        ? { ...material, sha256: HASH_B } : material),
    }), /AGENT_REVIEW_SUBJECT_MATERIAL_INVALID/u);
  }
  tested.add(`${route.product_id}\0${route.action_id}`);
}
assert.equal(tested.size, 40);
const staticRoute = productionRoutePolicies.find((route) => route.product_id === "localization_static_catalog");
assert(staticRoute);
const staticSuccessor = taskFor(staticRoute);
const { parent_task_ref: _task, parent_result_ref: _result, parent_result_hash: _hash, ...staticWithoutParent } = staticSuccessor;
assert.doesNotThrow(() => assertProductionTaskRoutePolicy({
  ...staticWithoutParent, parameters: { ...staticWithoutParent.parameters, target_locale: "zh-HK" },
} as WebsiteAgentTask));
assert.throws(() => assertProductionTaskRoutePolicy(staticWithoutParent as WebsiteAgentTask),
  /AGENT_ROUTE_RELATION_KIND_INVALID/u);
assert.throws(
  () => assertProductRouteSupported("bazi_basic_chart" as never, "produce" as never),
  /PLUGIN_ROUTE_UNSUPPORTED/u,
);

const observation = {
  schema_version: "xuanxue-ai-worker-observation.v6", observed_at: new Date().toISOString(),
  claim_exclusion_counts: [{ reason_code: "NO_UNFINISHED_V6_DEMAND", count: 1 }],
  nearest_retry_not_before: null, scope_total: 0, scope_truncated: false, jobs: [],
};
assert.doesNotThrow(() => WorkerObservationV6Schema.parse(observation));
assert.throws(() => WorkerObservationV6Schema.parse({ ...observation,
  claim_exclusion_counts: [{ reason_code: "GLOBAL_QUEUE_EMPTY_OR_INELIGIBLE", count: 1 }] }));
const privacyClosedJob = {
  job_id: "job-privacy-closed", product_id: "public_knowledge_article_pipeline",
  action_id: "produce_article", status: "failed", current_reason_code: "PRIVACY_SUBJECT_CLOSED",
  accepted_attempt_count: 1, attempt_id: null, next_action_code: "WAIT_NEW_ATTEMPT",
  next_action_at: "9999-12-31T23:59:59.999Z", authority_ref: "ai_production_job_runtime:job-privacy-closed",
  business_admission_receipt_hash: null,
} as const;
assert.doesNotThrow(() => WorkerObservationV6Schema.parse({
  ...observation, scope_total: 1, jobs: [privacyClosedJob],
}), "a permanent privacy decision must remain parseable so Runtime can release the exact Tab");
assert.throws(() => WorkerObservationV6Schema.parse({
  ...observation, scope_total: 1, jobs: [{ ...privacyClosedJob, next_action_at: null }],
}), /V6_OBSERVED_JOB_TTL_INVALID/u);

const sample = taskFor(productionRoutePolicies[0]!);
assert.throws(() => assertProductionTaskRoutePolicy({
  ...sample,
  parameters: { ...sample.parameters, forbidden_extra: true },
}), /AGENT_ROUTE_PARAMETER_SET_INVALID/u);

process.stdout.write("[ACCEPTANCE][agent-route-contract] PASS 40/46/33/0\n");
for (const evidenceMode of ["exam.golden", "exam.property"] as const) {
  emitQualityProofObservation({
    lawId: "LAW-AGENT-PRODUCTION-RUNTIME-003-V38",
    evidenceMode,
    clauses: ["forbidden:0", "forbidden:1", "forbidden:2", "forbidden:3", "summary"],
    locator: `acceptance:agent-production-runtime:route-contract:${evidenceMode}`,
    observedValue: "provider-derived route projection accepted exact route keys materials relations and result contracts without re-adjudicating Website-authorized parameter values",
  });
}
