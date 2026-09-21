import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { productResultValidation as result } from "../../mediator/product-plugin-contract.js";

const BAZI_CHART_INTERPRETATION_RESULT_FIELDS = [
  "schema_version", "chart_ref", "chart_version", "chart_hash",
  "bazi_pdf_semantic_manifest_ref", "manifest_hash",
  "report_summary", "interpretation_blocks", "citations",
  "uncertainties", "limitations", "safety_notes", "covered_semantic_anchor_refs",
] as const;

export const parseProductResult = (
  task: WebsiteAgentTask,
  value: unknown,
  route: ProductionRoutePolicy,
  _phase: "draft" | "final" = "final",
): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "bazi_chart_interpretation") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, BAZI_CHART_INTERPRETATION_RESULT_FIELDS, "BAZI_CHART_INTERPRETATION_RESULT_FIELDS_INVALID");
  result.locked(output, task, ["chart_ref", "chart_version", "chart_hash", "bazi_pdf_semantic_manifest_ref"]);
  if (output.manifest_hash !== task.parameters.bazi_pdf_semantic_manifest_hash) {
    throw new Error("BAZI_CHART_INTERPRETATION_MANIFEST_HASH_LOCK_INVALID");
  }
  result.commonReport(output, "report_summary", "interpretation_blocks");
  result.stringArray(output.covered_semantic_anchor_refs, "BAZI_CHART_INTERPRETATION_COVERAGE_INVALID", true);
  return Object.freeze(output);
};
