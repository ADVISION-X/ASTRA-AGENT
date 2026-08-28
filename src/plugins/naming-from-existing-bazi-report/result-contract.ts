import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "naming_from_existing_bazi_report") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "requirement_manifest_ref", "requirement_manifest_hash", "naming_rationale", "candidates", "comparison_or_selection_rationale", "uncertainties", "limitations", "safety_notes", "covered_requirement_anchor_refs"], "NAMING_RESULT_FIELDS_INVALID");
  result.locked(output, task, ["requirement_manifest_ref", "requirement_manifest_hash"]);
  result.dual(output.naming_rationale, "NAMING_RATIONALE_INVALID");
  result.dual(output.comparison_or_selection_rationale, "NAMING_COMPARISON_INVALID");
  result.array(output.candidates, "NAMING_CANDIDATES_INVALID", true);
  result.stringArray(output.uncertainties, "NAMING_UNCERTAINTIES_INVALID");
  result.stringArray(output.limitations, "NAMING_LIMITATIONS_INVALID");
  result.stringArray(output.safety_notes, "NAMING_SAFETY_INVALID");
  result.stringArray(output.covered_requirement_anchor_refs, "NAMING_COVERAGE_INVALID", true);
  return Object.freeze(output);
};

export const parseRouteResult = (task: WebsiteAgentTask, raw: string): Readonly<Record<string, unknown>> =>
  parseProductResult(task, result.parseJsonObject(raw, "AGENT_ROUTE_RESULT"));
