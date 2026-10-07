import { productResultValidation, type WebsiteAgentTask, type ProductionRoutePolicy } from "../../mediator/product-plugin-contract.js";

export function parseProductResult(task: WebsiteAgentTask, input: unknown, route: ProductionRoutePolicy): Readonly<Record<string, unknown>> {
  if (task.product_id !== "naming_bazi_analysis_and_naming" || route.product_id !== task.product_id || route.action_id !== task.action_id) {
    throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  }
  if (route.relation_kind === "review") return productResultValidation.parseReview(JSON.stringify(input));
  const output = productResultValidation.object(input, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  const bazi = productResultValidation.object(output.bazi_analysis, "NAMING_BAZI_RESULT_INVALID");
  const naming = productResultValidation.object(output.naming, "NAMING_RESULT_INVALID");
  if (bazi.schema_version !== "bazi-naming-basis-report-output.v1" || naming.schema_version !== "naming-report-output.v2") {
    throw new Error("NAMING_COMBINED_SCHEMA_INVALID");
  }
  productResultValidation.locked(bazi, task, ["chart_ref", "chart_version", "chart_hash"]);
  productResultValidation.hash(bazi.manifest_hash, "NAMING_BAZI_MANIFEST_HASH_INVALID");
  productResultValidation.hash(bazi.naming_requirement_manifest_hash, "NAMING_REQUIREMENT_HASH_INVALID");
  if (naming.requirement_manifest_ref !== bazi.naming_requirement_manifest_ref
    || naming.requirement_manifest_hash !== bazi.naming_requirement_manifest_hash) throw new Error("NAMING_REQUIREMENT_IDENTITY_INVALID");
  for (const layers of [bazi.report_summary, naming.naming_rationale, naming.comparison_or_selection_rationale]) {
    const pair = productResultValidation.object(layers, "NAMING_DUAL_LAYER_INVALID");
    if (typeof pair.professional_markdown !== "string" || typeof pair.reader_explanation_markdown !== "string") {
      throw new Error("NAMING_DUAL_LAYER_INVALID");
    }
  }
  for (const key of ["interpretation_blocks", "citations", "uncertainties", "limitations", "safety_notes",
    "covered_semantic_anchor_refs", "covered_requirement_anchor_refs"]) productResultValidation.array(bazi[key], "NAMING_BAZI_ARRAY_INVALID");
  for (const key of ["candidates", "uncertainties", "limitations", "safety_notes", "covered_requirement_anchor_refs"]) {
    productResultValidation.array(naming[key], "NAMING_RESULT_ARRAY_INVALID");
  }
  return Object.freeze(output);
}
