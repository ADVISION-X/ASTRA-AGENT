import projection from "./website-agent-route-policies.v1.json" with { type: "json" };
import dependency from "../../../../docs/specs/agent-production-runtime/website-agent-task-result.dependency.spec.json" with { type: "json" };
import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../../mediator/product-plugin-contract.js";
export type { ProductionRoutePolicy } from "../../../mediator/product-plugin-contract.js";

if (projection.schema_version !== "website-agent-route-policies.v1"
  || projection.contract_id !== dependency.contract.contractId
  || projection.contract_version !== dependency.contract.version
  || projection.contract_version !== dependency.version) {
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

const parameterTypes: Readonly<Record<string, string>> = projection.parameter_types;
function matchesParameterShape(type: string | undefined, value: unknown): boolean {
  switch (type) {
    case "positive_integer": return Number.isSafeInteger(value) && Number(value) > 0;
    case "nonnegative_integer": return Number.isSafeInteger(value) && Number(value) >= 0;
    case "nullable_positive_integer": return value === null || Number.isSafeInteger(value) && Number(value) > 0;
    case "uuid": return typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(value);
    case "sha256": return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value);
    case "string": return typeof value === "string";
    // Website owns the allowed business values for these string-shaped parameters.
    case "nullable_non_empty_string": return value === null || typeof value === "string" && !!value.trim();
    case "non_empty_string":
    case "research_tier":
    case "research_purpose":
    case "payment_observation_version": return typeof value === "string" && value.trim().length > 0;
    default: return false;
  }
}

export function assertProductionTaskRoutePolicy(task: WebsiteAgentTask): void {
  const route = productionRoutePolicy(task.product_id, task.action_id);
  const actual = Object.keys(task.parameters).sort();
  const expected = [...route.required_parameter_keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error("AGENT_ROUTE_PARAMETER_SET_INVALID");
  }
  if (expected.some(key => !matchesParameterShape(parameterTypes[key], task.parameters[key]))) {
    throw new Error("AGENT_ROUTE_PARAMETER_SHAPE_INVALID");
  }
  assertMaterialRoles(task, route);
  const parent = [task.parent_task_ref, task.parent_result_ref, task.parent_result_hash].filter(x => x !== undefined);
  const review = [task.subject_task_ref, task.subject_result_ref, task.subject_result_hash, task.review_policy].filter(x => x !== undefined);
  if (parent.length !== 0 || review.length !== 0 || route.relation_kind !== "primary") {
    throw new Error("AGENT_ROUTE_RELATION_KIND_INVALID");
  }
}
