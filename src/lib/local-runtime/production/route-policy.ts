import { type ProductionActionId, type ProductionProductId, type WebsiteAgentTask } from "./contracts.js";
import type { ProductionRoutePolicy } from "../../../mediator/product-plugin-contract.js";
import routePolicyArtifact from "./website-agent-route-policies.v1.json" with { type: "json" };

export type { ProductionRoutePolicy } from "../../../mediator/product-plugin-contract.js";

type RoutePolicyProjection = Readonly<{
  schema_version: "website-agent-route-policies.v1";
  contract_id: "ai-acceptance.website-agent-task-result";
  contract_version: 13;
  parameter_types: Readonly<Record<string, string>>;
  routes: readonly ProductionRoutePolicy[];
}>;

const projection = routePolicyArtifact as RoutePolicyProjection;
if (projection.schema_version !== "website-agent-route-policies.v1"
  || projection.contract_id !== "ai-acceptance.website-agent-task-result"
  || projection.contract_version !== 13
  || !projection.parameter_types
  || Object.keys(projection.parameter_types).length !== 46
  || projection.routes.length !== 40) {
  throw new Error("PRODUCTION_ROUTE_POLICY_PROJECTION_INVALID");
}

export const productionRoutePolicies = Object.freeze(projection.routes.map((entry) => Object.freeze({
  ...entry,
  required_parameter_keys: Object.freeze([...entry.required_parameter_keys]),
  material_roles: Object.freeze(entry.material_roles.map((material) => Object.freeze({ ...material }))),
})));
export const productionRoutePolicyMap = new Map(
  productionRoutePolicies.map((entry) => [`${entry.product_id}\0${entry.action_id}`, entry] as const),
);
const resultContractCount = productionRoutePolicies.filter((entry) => entry.result_contract !== undefined).length;
if (productionRoutePolicies.length !== 40 || productionRoutePolicyMap.size !== 40
  || resultContractCount !== 33) {
  throw new Error("PRODUCTION_ROUTE_POLICY_DENOMINATOR_INVALID");
}

export function productionRoutePolicy(
  productId: ProductionProductId,
  actionId: ProductionActionId,
): ProductionRoutePolicy {
  const resolved = productionRoutePolicyMap.get(`${productId}\0${actionId}`);
  if (!resolved) throw new Error(`PRODUCTION_ROUTE_POLICY_MISSING:${productId}:${actionId}`);
  return resolved;
}

const assertRouteParameters = (task: WebsiteAgentTask, expected: ProductionRoutePolicy): void => {
  if (Object.keys(task.parameters).sort().join("\0")
    !== [...expected.required_parameter_keys].sort().join("\0")) {
    throw new Error("AGENT_ROUTE_PARAMETER_SET_INVALID");
  }
};

const assertRouteMaterials = (task: WebsiteAgentTask, expected: ProductionRoutePolicy): void => {
  const materials = [...task.material_refs].sort((left, right) => left.ordinal - right.ordinal);
  if (materials.length !== expected.material_roles.length) throw new Error("AGENT_ROUTE_MATERIAL_SET_INVALID");
  for (const [index, role] of expected.material_roles.entries()) {
    const material = materials[index];
    if (!material || material.ordinal !== index || material.role !== role.role
      || material.trust_class !== role.trust_class
      || material.may_issue_instruction !== role.may_issue_instruction
      || !role.media_types.includes(material.media_type)
      || material.storage_class !== role.storage_class
      || (role.owner_scope_policy === "required") !== (material.owner_scope_hash !== null)) {
      throw new Error("AGENT_ROUTE_MATERIAL_SET_INVALID");
    }
  }
};

const assertRouteRelation = (task: WebsiteAgentTask, expected: ProductionRoutePolicy): void => {
  const materials = [...task.material_refs].sort((left, right) => left.ordinal - right.ordinal);
  const parentIdentity = [task.parent_task_ref, task.parent_result_ref, task.parent_result_hash];
  const reviewIdentity = [task.subject_task_ref, task.subject_result_ref, task.subject_result_hash,
    task.review_policy];
  const staticRoot = task.product_id === "localization_static_catalog"
    && task.action_id === "produce_locale_catalog" && task.parameters.target_locale === "zh-HK";
  const parentRequired = expected.relation_kind === "followup"
    || expected.relation_kind === "provider_continuation" && !staticRoot;
  if (parentRequired !== parentIdentity.every((value) => value !== undefined)
    || (expected.relation_kind === "review") !== reviewIdentity.every((value) => value !== undefined)
    || (!parentRequired && parentIdentity.some((value) => value !== undefined))
    || (expected.relation_kind !== "review" && reviewIdentity.some((value) => value !== undefined))) {
    throw new Error("AGENT_ROUTE_RELATION_KIND_INVALID");
  }
  if (expected.relation_kind === "review") {
    const subject = materials.find((material) => material.role === "subject_result");
    if (!subject || subject.sha256 !== task.subject_result_hash) {
      throw new Error("AGENT_REVIEW_SUBJECT_MATERIAL_INVALID");
    }
  }
};

export function assertProductionTaskRoutePolicy(task: WebsiteAgentTask): void {
  const expected = productionRoutePolicy(task.product_id, task.action_id);
  assertRouteParameters(task, expected);
  assertRouteMaterials(task, expected);
  assertRouteRelation(task, expected);
}
