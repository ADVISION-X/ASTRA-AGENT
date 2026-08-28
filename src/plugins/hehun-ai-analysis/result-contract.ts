import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "hehun_ai_analysis") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "case_manifest_ref", "case_manifest_hash", "question_snapshot", "relationship_summary", "relationship_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_question_unit_refs"], "HEHUN_RESULT_FIELDS_INVALID");
  result.locked(output, task, ["case_manifest_ref", "case_manifest_hash"]);
  result.commonReport(output, "relationship_summary", "relationship_blocks");
  result.stringArray(output.covered_question_unit_refs, "HEHUN_COVERAGE_INVALID", true);
  return Object.freeze(output);
};

export const parseRouteResult = (task: WebsiteAgentTask, raw: string): Readonly<Record<string, unknown>> =>
  parseProductResult(task, result.parseJsonObject(raw, "AGENT_ROUTE_RESULT"));
