import projection from "./website-agent-route-policies.v1.json" with { type: "json" };
import type { ProductionProductId, ProductionActionId, WebsiteAgentTask } from "./contracts.js";
import type { ProductionRoutePolicy } from "../../../mediator/product-plugin-contract.js";
export type { ProductionRoutePolicy } from "../../../mediator/product-plugin-contract.js";

if (projection.schema_version !== "website-agent-route-policies.v1" || projection.contract_id !== "ai-acceptance.website-agent-task-result"
  || projection.contract_version !== 24 || Object.keys(projection.parameter_types).length !== 43 || projection.routes.length !== 43) {
  throw new Error("PRODUCTION_ROUTE_POLICY_PROJECTION_INVALID");
}
export const productionRoutePolicies: readonly ProductionRoutePolicy[] = Object.freeze(projection.routes.map((route) => Object.freeze({
  ...route, relation_kind: route.relation_kind as ProductionRoutePolicy["relation_kind"],
  required_parameter_keys: Object.freeze([...route.required_parameter_keys]),
  material_roles: Object.freeze(route.material_roles.map((material) => Object.freeze({
    ...material, trust_class: material.trust_class as ProductionRoutePolicy["material_roles"][number]["trust_class"],
    storage_class: material.storage_class as "shared_static" | "private_owner_scoped",
    owner_scope_policy: material.owner_scope_policy as "required" | "forbidden", media_types: Object.freeze([...material.media_types]),
  }))),
})));
export const productionRoutePolicyMap = new Map(productionRoutePolicies.map((route) => [`${route.product_id}\0${route.action_id}`, route]));
if (productionRoutePolicyMap.size !== 43 || productionRoutePolicies.filter((route) => route.result_contract !== undefined).length !== 43) {
  throw new Error("PRODUCTION_ROUTE_POLICY_DENOMINATOR_INVALID");
}
export function productionRoutePolicy(product: ProductionProductId, action: ProductionActionId): ProductionRoutePolicy {
  const route = productionRoutePolicyMap.get(`${product}\0${action}`);
  if (!route) throw new Error(`PRODUCTION_ROUTE_POLICY_MISSING:${product}:${action}`);
  return route;
}
function assertParameters(task: WebsiteAgentTask, route: ProductionRoutePolicy): void {
  const actual = Object.keys(task.parameters).sort();
  const expected = [...route.required_parameter_keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) throw new Error("AGENT_ROUTE_PARAMETER_SET_INVALID");
}
function assertMaterials(task: WebsiteAgentTask, route: ProductionRoutePolicy): void {
  const ordered = [...task.material_refs].sort((a, b) => a.ordinal - b.ordinal);
  if (ordered.length > 64) throw new Error("AGENT_ROUTE_MATERIAL_SET_INVALID");
  let cursor = 0;
  for (const required of route.material_roles) {
    let part = 0;
    do {
      const entry = ordered[cursor];
      if (!entry || entry.ordinal !== cursor || entry.role !== required.role
        || entry.trust_class !== required.trust_class || entry.may_issue_instruction !== required.may_issue_instruction
        || !required.media_types.includes(entry.media_type) || entry.storage_class !== required.storage_class
        || (required.owner_scope_policy === "required") !== (entry.owner_scope_hash !== null)
        || (required.repeatable === true && entry.material_id !== `${task.source_task_id}:${required.role}:${part}`)) {
        throw new Error("AGENT_ROUTE_MATERIAL_SET_INVALID");
      }
      cursor += 1;
      part += 1;
    } while (required.repeatable === true && ordered[cursor]?.role === required.role);
  }
  if (cursor !== ordered.length) throw new Error("AGENT_ROUTE_MATERIAL_SET_INVALID");
}
function assertRelation(task: WebsiteAgentTask, route: ProductionRoutePolicy): void {
  const ordered = [...task.material_refs].sort((a, b) => a.ordinal - b.ordinal);
  const parentCount = [task.parent_task_ref, task.parent_result_ref, task.parent_result_hash].filter((value) => value !== undefined).length;
  const reviewCount = [task.subject_task_ref, task.subject_result_ref, task.subject_result_hash, task.review_policy].filter((value) => value !== undefined).length;
  const catalog = task.product_id === "localization_static_catalog" && task.action_id === "produce_locale_catalog";
  const continuation = ["followup", "provider_continuation"].includes(route.relation_kind);
  if ((catalog ? parentCount !== 0 && parentCount !== 3 : continuation ? parentCount !== 3 : parentCount !== 0)
    || (route.relation_kind === "review" ? reviewCount !== 4 : reviewCount !== 0)) throw new Error("AGENT_ROUTE_RELATION_KIND_INVALID");
  if (route.relation_kind === "review" && !ordered.some((entry) => entry.role === "subject_result" && entry.sha256 === task.subject_result_hash)) {
    throw new Error("AGENT_REVIEW_SUBJECT_MATERIAL_INVALID");
  }
}
export function assertProductionTaskRoutePolicy(task: WebsiteAgentTask): void {
  const route = productionRoutePolicy(task.product_id, task.action_id);
  assertParameters(task, route);
  assertMaterials(task, route);
  assertRelation(task, route);
}
