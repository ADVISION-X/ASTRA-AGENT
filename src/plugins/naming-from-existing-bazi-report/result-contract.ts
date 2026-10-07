import { productResultValidation, type WebsiteAgentTask, type ProductionRoutePolicy } from "../../mediator/product-plugin-contract.js";

// Product receives the declared shape; Website's Naming Owner makes the full domain verdict.
export function parseProductResult(task: WebsiteAgentTask, input: unknown, route: ProductionRoutePolicy): Readonly<Record<string, unknown>> {
  if (task.product_id !== "naming_from_existing_bazi_report" || route.product_id !== task.product_id || route.action_id !== task.action_id) {
    throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  }
  if (route.relation_kind === "review") return productResultValidation.parseReview(JSON.stringify(input));
  const output = productResultValidation.object(input, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  productResultValidation.locked(output, task, ["requirement_manifest_ref", "requirement_manifest_hash"]);
  for (const key of ["naming_rationale", "comparison_or_selection_rationale"]) {
    const layers = productResultValidation.object(output[key], "NAMING_DUAL_LAYER_INVALID");
    if (typeof layers.professional_markdown !== "string" || typeof layers.reader_explanation_markdown !== "string") {
      throw new Error("NAMING_DUAL_LAYER_INVALID");
    }
  }
  for (const key of ["candidates", "uncertainties", "limitations", "safety_notes", "covered_requirement_anchor_refs"]) {
    productResultValidation.array(output[key], "NAMING_RESULT_ARRAY_INVALID");
  }
  return Object.freeze(output);
}
