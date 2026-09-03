import { hashCanonical, type ProductionActionId, type ProductionHash, type ProductionProductId,
  type WebsiteAgentTask } from "./contracts.js";
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
  readonly result_contract?: Readonly<Record<string, unknown>>;
  readonly relation_kind: "primary" | "continuation" | "review";
}

type RoutePolicyProjection = Readonly<{
  schema_version: "website-agent-route-policies.v1";
  contract_id: "ai-acceptance.website-agent-task-result";
  contract_version: 1;
  parameter_types: Readonly<Record<string, string>>;
  routes: readonly ProductionRoutePolicy[];
}>;

const projection = routePolicyArtifact as RoutePolicyProjection;
if (projection.schema_version !== "website-agent-route-policies.v1"
  || projection.contract_id !== "ai-acceptance.website-agent-task-result"
  || projection.contract_version !== 1
  || !projection.parameter_types
  || Object.keys(projection.parameter_types).length !== 57
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
const resultContractCount = productionRoutePolicies.filter((entry) => entry.result_contract !== undefined).length;
const reusableBaseReservationRouteCount = productionRoutePolicies.filter((entry) =>
  entry.required_parameter_keys.includes("reusable_base_reservation_ref")
  && entry.required_parameter_keys.includes("reusable_base_reservation_hash")).length;
if (productionRoutePolicies.length !== 39 || productionRoutePolicyMap.size !== 39
  || resultContractCount !== 30 || reusableBaseReservationRouteCount !== 2) {
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

export function evaluateExactNestedResultContract(input: Readonly<{
  artifactHash: ProductionHash;
  value: Readonly<Record<string, unknown>>;
  contract: Readonly<Record<string, unknown>>;
  topLevelFieldsKey: string;
  nestedArrayFields: Readonly<Record<string, string>>;
}>): Readonly<{
  artifact_hash: ProductionHash;
  contract_hash: ProductionHash;
  outcome: "accepted";
  evaluation_hash: ProductionHash;
}> {
  const expectedTop = input.contract[input.topLevelFieldsKey];
  if (!Array.isArray(expectedTop) || !expectedTop.every((field) => typeof field === "string")
    || Object.keys(input.value).sort().join("\0") !== [...expectedTop].sort().join("\0")) {
    throw new Error("EXACT_NESTED_RESULT_CONTRACT_TOP_LEVEL_INVALID");
  }
  for (const [valueKey, contractKey] of Object.entries(input.nestedArrayFields)) {
    const expectedFields = input.contract[contractKey];
    const values = input.value[valueKey];
    if (!Array.isArray(expectedFields) || !expectedFields.every((field) => typeof field === "string")
      || !Array.isArray(values)) throw new Error("EXACT_NESTED_RESULT_CONTRACT_ARRAY_INVALID");
    for (const child of values) {
      if (!child || typeof child !== "object" || Array.isArray(child)
        || Object.keys(child).sort().join("\0") !== [...expectedFields].sort().join("\0")) {
        throw new Error("EXACT_NESTED_RESULT_CONTRACT_CHILD_INVALID");
      }
    }
  }
  const contractHash = hashCanonical(input.contract);
  const evaluationStable = {
    kind: "exact-nested-result-contract-evaluation.v1",
    artifact_hash: input.artifactHash,
    contract_hash: contractHash,
    outcome: "accepted" as const,
  };
  return Object.freeze({
    artifact_hash: input.artifactHash,
    contract_hash: contractHash,
    outcome: "accepted",
    evaluation_hash: hashCanonical(evaluationStable),
  });
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
};

export function assertProductionTaskRoutePolicy(task: WebsiteAgentTask): void {
  const expected = productionRoutePolicy(task.product_id, task.action_id);
  assertRouteParameters(task, expected);
  assertRouteMaterials(task, expected);
  assertRouteRelation(task, expected);
}
