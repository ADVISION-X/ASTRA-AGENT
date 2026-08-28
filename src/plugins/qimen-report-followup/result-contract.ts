import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "qimen_report_followup") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "thread_ref", "parent_report_ref", "parent_raw_output_hash", "continuation_relation", "new_question_snapshot", "answer_summary", "answer_blocks", "citations", "uncertainties", "limitations", "safety_notes", "index_review_receipts", "covered_question_unit_refs", "covered_candidate_refs"], "QIMEN_FOLLOWUP_RESULT_FIELDS_INVALID");
  result.locked(output, task, ["parent_report_ref", "parent_raw_output_hash"]);
  if (output.thread_ref !== task.continuation_ref || output.continuation_relation !== "same_conversation_followup") {
    throw new Error("QIMEN_FOLLOWUP_RELATION_INVALID");
  }
  result.commonReport(output, "answer_summary", "answer_blocks");
  result.array(output.index_review_receipts, "QIMEN_INDEX_REVIEW_INVALID", true);
  result.stringArray(output.covered_question_unit_refs, "QIMEN_QUESTION_COVERAGE_INVALID", true);
  result.stringArray(output.covered_candidate_refs, "QIMEN_CANDIDATE_COVERAGE_INVALID", true);
  return Object.freeze(output);
};

export const parseRouteResult = (task: WebsiteAgentTask, raw: string): Readonly<Record<string, unknown>> =>
  parseProductResult(task, result.parseJsonObject(raw, "AGENT_ROUTE_RESULT"));
