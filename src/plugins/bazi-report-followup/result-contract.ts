import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { productResultValidation as result } from "../../mediator/product-plugin-contract.js";

const BAZI_REPORT_FOLLOWUP_RESULT_FIELDS = [
  "schema_version", "parent_report_ref", "parent_raw_output_hash", "new_question_snapshot",
  "answer_summary", "answer_blocks", "citations", "uncertainties", "limitations",
  "safety_notes", "covered_question_unit_refs",
] as const;

export const parseProductResult = (task: WebsiteAgentTask, value: unknown, route: ProductionRoutePolicy): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "bazi_report_followup") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, BAZI_REPORT_FOLLOWUP_RESULT_FIELDS, "BAZI_REPORT_FOLLOWUP_RESULT_FIELDS_INVALID");
  result.locked(output, task, ["parent_report_ref", "parent_raw_output_hash"]);
  result.commonReport(output, "answer_summary", "answer_blocks");
  result.stringArray(output.covered_question_unit_refs, "BAZI_REPORT_FOLLOWUP_COVERAGE_INVALID", true);
  return Object.freeze(output);
};
