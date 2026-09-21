import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { productResultValidation as result } from "../../mediator/product-plugin-contract.js";

const BAZI_AI_FULL_ANALYSIS_RESULT_FIELDS = [
  "schema_version", "question_snapshot", "answer_summary", "answer_blocks",
  "citations", "uncertainties", "limitations", "safety_notes", "covered_question_unit_refs",
] as const;

export const parseProductResult = (task: WebsiteAgentTask, value: unknown, route: ProductionRoutePolicy): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "bazi_ai_full_analysis") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, BAZI_AI_FULL_ANALYSIS_RESULT_FIELDS, "BAZI_AI_FULL_ANALYSIS_RESULT_FIELDS_INVALID");
  const questionSnapshot = result.object(output.question_snapshot, "BAZI_AI_FULL_ANALYSIS_QUESTION_SNAPSHOT_INVALID");
  if (questionSnapshot.question_ref !== task.parameters.question_snapshot_ref) {
    throw new Error("BAZI_AI_FULL_ANALYSIS_QUESTION_SNAPSHOT_LOCK_INVALID");
  }
  result.commonReport(output, "answer_summary", "answer_blocks");
  result.stringArray(output.covered_question_unit_refs, "BAZI_AI_FULL_ANALYSIS_COVERAGE_INVALID", true);
  return Object.freeze(output);
};
