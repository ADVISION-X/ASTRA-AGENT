import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { productResultValidation as result } from "../../mediator/product-plugin-contract.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown, route: ProductionRoutePolicy): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "hehun_ai_analysis") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "case_manifest_ref", "case_manifest_hash", "question_snapshot", "relationship_summary", "relationship_blocks", "citations", "uncertainties", "limitations", "safety_notes", "covered_question_unit_refs"], "HEHUN_RESULT_FIELDS_INVALID");
  result.locked(output, task, ["case_manifest_ref", "case_manifest_hash"]);
  result.commonReport(output, "relationship_summary", "relationship_blocks");
  result.stringArray(output.covered_question_unit_refs, "HEHUN_COVERAGE_INVALID", true);
  return Object.freeze(output);
};
