import { productResultValidation as result, type ProductionRoutePolicy, type WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";

export function parseProductResult(task: WebsiteAgentTask, value: unknown, route: ProductionRoutePolicy): Readonly<Record<string, unknown>> {
  if (task.product_id !== "bazi_chart_interpretation" || route.product_id !== task.product_id || route.action_id !== task.action_id) {
    throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  }
  const output = { ...result.object(value, "AGENT_RESULT_OBJECT_REQUIRED") };
  if (route.relation_kind === "review") {
    if (output.decision !== "no_issue" && output.decision !== "issues") throw new Error("AGENT_REVIEW_DECISION_INVALID");
    if (output.issues && typeof output.issues === "object" && !Array.isArray(output.issues)) output.issues = [output.issues];
    result.array(output.issues, "AGENT_REVIEW_ISSUES_REQUIRED");
    return Object.freeze(output);
  }
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.locked(output, task, ["chart_ref", "chart_version", "chart_hash", "fact_semantic_manifest_ref"]);
  if (output.manifest_hash !== task.parameters.fact_semantic_manifest_hash) {
    throw new Error("BAZI_CHART_INTERPRETATION_MANIFEST_HASH_LOCK_INVALID");
  }
  for (const field of ["uncertainties", "limitations", "safety_notes"]) {
    if (typeof output[field] === "string") output[field] = [output[field]];
  }
  return Object.freeze(output);
}
