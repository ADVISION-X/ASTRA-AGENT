import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { productResultValidation as result } from "../../mediator/product-plugin-contract.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown, route: ProductionRoutePolicy): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "qimen_professional_answer") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "question_snapshot", "answer_summary", "answer_blocks", "citations", "uncertainties", "limitations", "safety_notes", "index_review_receipts", "covered_question_unit_refs", "covered_candidate_refs"], "QIMEN_RESULT_FIELDS_INVALID");
  result.commonReport(output, "answer_summary", "answer_blocks");
  result.array(output.index_review_receipts, "QIMEN_INDEX_REVIEW_INVALID", true);
  result.stringArray(output.covered_question_unit_refs, "QIMEN_QUESTION_COVERAGE_INVALID", true);
  result.stringArray(output.covered_candidate_refs, "QIMEN_CANDIDATE_COVERAGE_INVALID", true);
  return Object.freeze(output);
};
