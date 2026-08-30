import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "hehun_report_followup") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "thread_ref", "parent_report_ref", "parent_raw_output_hash", "new_question_snapshot", "answer_summary", "answer_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_question_unit_refs"], "HEHUN_FOLLOWUP_RESULT_FIELDS_INVALID");
  result.locked(output, task, ["thread_ref", "parent_report_ref", "parent_raw_output_hash"]);
  result.commonReport(output, "answer_summary", "answer_blocks");
  result.stringArray(output.covered_question_unit_refs, "HEHUN_FOLLOWUP_COVERAGE_INVALID", true);
  return Object.freeze(output);
};
