import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

export const parseProductResult = (
  task: WebsiteAgentTask,
  value: unknown,
  _phase: "draft" | "final" = "final",
): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "bazi_chart_interpretation") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "chart_ref", "chart_version", "chart_hash", "bazi_pdf_semantic_manifest_ref", "manifest_hash", "report_summary", "interpretation_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_semantic_anchor_refs"], "BAZI_CHART_RESULT_FIELDS_INVALID");
  result.locked(output, task, ["chart_ref", "chart_version", "chart_hash"]);
  result.hash(output.manifest_hash, "BAZI_CHART_MANIFEST_HASH_INVALID");
  result.commonReport(output, "report_summary", "interpretation_blocks");
  result.stringArray(output.covered_semantic_anchor_refs, "BAZI_CHART_COVERAGE_INVALID", true);
  return Object.freeze(output);
};

export const parseRouteResult = (task: WebsiteAgentTask, raw: string): Readonly<Record<string, unknown>> =>
  parseProductResult(task, result.parseJsonObject(raw, "AGENT_ROUTE_RESULT"), "final");
