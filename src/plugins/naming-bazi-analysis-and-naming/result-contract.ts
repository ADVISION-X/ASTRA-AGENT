import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "naming_bazi_analysis_and_naming") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "bazi_analysis", "naming"], "NAMING_COMBINED_RESULT_FIELDS_INVALID");
  const bazi = result.object(output.bazi_analysis, "NAMING_BAZI_RESULT_INVALID");
  result.exact(bazi, ["schema_version", "chart_ref", "chart_version", "chart_hash", "bazi_pdf_semantic_manifest_ref", "manifest_hash", "naming_requirement_manifest_ref", "naming_requirement_manifest_hash", "report_summary", "interpretation_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_semantic_anchor_refs", "covered_requirement_anchor_refs"], "NAMING_BAZI_RESULT_FIELDS_INVALID");
  if (bazi.schema_version !== "bazi-naming-basis-report-output.v1") throw new Error("NAMING_BAZI_SCHEMA_INVALID");
  result.locked(bazi, task, ["chart_ref", "chart_version", "chart_hash"]);
  result.hash(bazi.manifest_hash, "NAMING_BAZI_MANIFEST_HASH_INVALID");
  result.hash(bazi.naming_requirement_manifest_hash, "NAMING_REQUIREMENT_HASH_INVALID");
  result.commonReport(bazi, "report_summary", "interpretation_blocks");
  result.stringArray(bazi.covered_semantic_anchor_refs, "NAMING_BAZI_COVERAGE_INVALID", true);
  result.stringArray(bazi.covered_requirement_anchor_refs, "NAMING_REQUIREMENT_COVERAGE_INVALID", true);
  const naming = result.object(output.naming, "NAMING_RESULT_INVALID");
  result.exact(naming, ["schema_version", "requirement_manifest_ref", "requirement_manifest_hash", "naming_rationale", "candidates", "comparison_or_selection_rationale", "uncertainties", "limitations", "safety_notes", "covered_requirement_anchor_refs"], "NAMING_RESULT_FIELDS_INVALID");
  if (naming.schema_version !== "naming-report-output.v2"
    || naming.requirement_manifest_ref !== bazi.naming_requirement_manifest_ref
    || naming.requirement_manifest_hash !== bazi.naming_requirement_manifest_hash) throw new Error("NAMING_SCHEMA_INVALID");
  result.dual(naming.naming_rationale, "NAMING_RATIONALE_INVALID");
  result.dual(naming.comparison_or_selection_rationale, "NAMING_COMPARISON_INVALID");
  result.array(naming.candidates, "NAMING_CANDIDATES_INVALID", true);
  result.stringArray(naming.uncertainties, "NAMING_UNCERTAINTIES_INVALID");
  result.stringArray(naming.limitations, "NAMING_LIMITATIONS_INVALID");
  result.stringArray(naming.safety_notes, "NAMING_SAFETY_INVALID");
  result.stringArray(naming.covered_requirement_anchor_refs, "NAMING_COVERAGE_INVALID", true);
  return Object.freeze(output);
};
