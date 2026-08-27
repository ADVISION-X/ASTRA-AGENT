import type { ProductionActionId, ProductionProductId, WebsiteAgentTask } from "./contracts.js";
import routePolicyArtifact from "./website-agent-route-policies.v1.json" with { type: "json" };

export interface ProductionRoutePolicy {
  readonly product_id: ProductionProductId;
  readonly action_id: ProductionActionId;
  readonly required_parameter_keys: readonly string[];
  readonly material_roles: readonly Readonly<{
    role: string;
    trust_class: WebsiteAgentTask["material_refs"][number]["trust_class"];
    may_issue_instruction: boolean;
    media_types: readonly string[];
    storage_class: WebsiteAgentTask["material_refs"][number]["storage_class"];
    owner_scope_policy: "required" | "forbidden";
  }>[];
  readonly result_schema_version: string;
  readonly relation_kind: "primary" | "continuation" | "review";
}

type ProductionParameterType =
  | "non_empty_string" | "sha256" | "non_empty_string_array"
  | "bazi_analysis_kind" | "public_knowledge_package_version"
  | "payment_observation_version" | "quality_reflection_version"
  | "route_result_schema_version" | "target_locale" | "locale"
  | "localization_resource_kind";

type RoutePolicyProjection = Readonly<{
  schema_version: "website-agent-route-policies.v1";
  contract_id: "ai-acceptance.website-agent-task-result";
  contract_version: 1;
  parameter_types: Readonly<Record<string, ProductionParameterType>>;
  routes: readonly ProductionRoutePolicy[];
}>;

const projection = routePolicyArtifact as RoutePolicyProjection;
if (projection.schema_version !== "website-agent-route-policies.v1"
  || projection.contract_id !== "ai-acceptance.website-agent-task-result"
  || projection.contract_version !== 1
  || !projection.parameter_types
  || Object.keys(projection.parameter_types).length !== 41
  || projection.routes.length !== 39) {
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
const productionParameterTypes = Object.freeze({ ...projection.parameter_types });

const primaryProducts = productionRoutePolicies.filter((entry) => entry.relation_kind !== "review")
  .map((entry) => entry.product_id);
if (primaryProducts.length !== 13 || new Set(primaryProducts).size !== 13
  || productionRoutePolicies.length !== 39 || productionRoutePolicyMap.size !== 39) {
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

export const routeProducesGeneratedImage = (task: Pick<WebsiteAgentTask, "product_id" | "action_id">): boolean =>
  task.product_id === "public_knowledge_article_pipeline" && task.action_id === "produce_article";

export function assertProductionTaskRoutePolicy(task: WebsiteAgentTask): void {
  const expected = productionRoutePolicy(task.product_id, task.action_id);
  if (Object.keys(task.parameters).sort().join("\0")
    !== [...expected.required_parameter_keys].sort().join("\0")) {
    throw new Error("AGENT_ROUTE_PARAMETER_SET_INVALID");
  }
  for (const [parameterKey, parameter] of Object.entries(task.parameters)) {
    const kind = productionParameterTypes[parameterKey];
    const nonempty = typeof parameter === "string" && parameter.trim().length > 0;
    const valid = kind === "non_empty_string" ? nonempty
      : kind === "sha256" ? typeof parameter === "string" && /^sha256:[a-f0-9]{64}$/u.test(parameter)
      : kind === "non_empty_string_array" ? Array.isArray(parameter) && parameter.length > 0
        && parameter.every((item) => typeof item === "string" && item.trim().length > 0)
      : kind === "bazi_analysis_kind" ? parameter === "chart_interpretation" || parameter === "question_analysis"
      : kind === "public_knowledge_package_version" ? parameter === "public-knowledge-article-package.v1"
      : kind === "payment_observation_version" ? parameter === "payment-screenshot-observation-v1"
      : kind === "quality_reflection_version" ? parameter === "scheduled-quality-reflection.v1"
      : kind === "route_result_schema_version" ? parameter === expected.result_schema_version
      : kind === "target_locale" ? ["zh-HK", "zh-TW", "en-US", "ja-JP", "ko-KR"].includes(String(parameter))
      : kind === "locale" ? ["zh-CN", "zh-HK", "zh-TW", "en-US", "ja-JP", "ko-KR"].includes(String(parameter))
      : kind === "localization_resource_kind" ? (task.product_id === "localization_report_translation"
        ? parameter === "report" : task.product_id === "localization_article_translation" && parameter === "article")
      : false;
    if (!valid) throw new Error(`AGENT_ROUTE_PARAMETER_VALUE_INVALID:${parameterKey}`);
  }
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
  const continuationIdentity = [task.continuation_ref, task.parent_task_ref, task.parent_result_ref,
    task.parent_result_hash];
  const reviewIdentity = [task.subject_task_ref, task.subject_result_ref, task.subject_result_hash,
    task.review_policy];
  if ((expected.relation_kind === "continuation") !== continuationIdentity.every((value) => value !== undefined)
    || (expected.relation_kind === "review") !== reviewIdentity.every((value) => value !== undefined)
    || (expected.relation_kind !== "continuation" && continuationIdentity.some((value) => value !== undefined))
    || (expected.relation_kind !== "review" && reviewIdentity.some((value) => value !== undefined))) {
    throw new Error("AGENT_ROUTE_RELATION_KIND_INVALID");
  }
  if (expected.relation_kind === "review") {
    const subject = materials.find((material) => material.role === "subject_result");
    if (!subject || subject.sha256 !== task.subject_result_hash) {
      throw new Error("AGENT_REVIEW_SUBJECT_MATERIAL_INVALID");
    }
  }
}
