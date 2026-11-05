import projection from "./website-agent-route-policies.v1.json" with { type: "json" };
import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../../mediator/product-plugin-contract.js";
export type { ProductionRoutePolicy } from "../../../mediator/product-plugin-contract.js";

if (projection.schema_version !== "website-agent-route-policies.v1"
  || projection.contract_id !== "astra.website-agent-task-result" || projection.contract_version !== 2) {
  throw new Error("PRODUCTION_ROUTE_POLICY_PROJECTION_INVALID");
}
export const productionRoutePolicies: readonly ProductionRoutePolicy[] = Object.freeze(
  projection.routes.map(route => route as ProductionRoutePolicy));
export const productionRoutePolicyMap = new Map(productionRoutePolicies.map(route =>
  [`${route.product_id}\0${route.action_id}`, route]));
if (productionRoutePolicyMap.size !== productionRoutePolicies.length) throw new Error("PRODUCTION_ROUTE_DUPLICATE");

export function productionRoutePolicy(product: string, action: string): ProductionRoutePolicy {
  const route = productionRoutePolicyMap.get(`${product}\0${action}`);
  if (!route) throw new Error(`PRODUCTION_ROUTE_POLICY_MISSING:${product}:${action}`);
  return route;
}
function assertMaterialRoles(task: WebsiteAgentTask, route: ProductionRoutePolicy): void {
  if (task.material_refs.length > 64) throw new Error("AGENT_ROUTE_MATERIAL_SET_INVALID");
  let ordinal = 0;
  for (const role of route.material_roles) {
    let count = 0;
    while (task.material_refs[ordinal]?.role === role.role) {
      const item = task.material_refs[ordinal]!;
      if (item.ordinal !== ordinal || item.trust_class !== role.trust_class
        || item.may_issue_instruction !== role.may_issue_instruction || item.storage_class !== role.storage_class
        || !role.media_types.some(type => type === "*/*" || type === item.media_type)
        || (role.owner_scope_policy === "required") !== (item.owner_scope_hash !== null)
        || role.repeatable === true && item.material_id !== `${task.source_task_id}:${role.role}:${count}`) {
        throw new Error("AGENT_ROUTE_MATERIAL_SET_INVALID");
      }
      ordinal += 1;
      count += 1;
    }
    if (count < (role.min_count ?? 1) || role.repeatable !== true && count > 1) {
      throw new Error("AGENT_ROUTE_MATERIAL_SET_INVALID");
    }
  }
  if (ordinal !== task.material_refs.length) throw new Error("AGENT_ROUTE_MATERIAL_SET_INVALID");
}
export function assertProductionTaskRoutePolicy(task: WebsiteAgentTask): void {
  const route = productionRoutePolicy(task.product_id, task.action_id);
  const actual = Object.keys(task.parameters).sort();
  const expected = [...route.required_parameter_keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error("AGENT_ROUTE_PARAMETER_SET_INVALID");
  }
  assertMaterialRoles(task, route);
  const parent = [task.parent_task_ref, task.parent_result_ref, task.parent_result_hash].filter(x => x !== undefined);
  const review = [task.subject_task_ref, task.subject_result_ref, task.subject_result_hash, task.review_policy].filter(x => x !== undefined);
  if (parent.length !== 0 || review.length !== 0 || route.relation_kind !== "primary") {
    throw new Error("AGENT_ROUTE_RELATION_KIND_INVALID");
  }
}
