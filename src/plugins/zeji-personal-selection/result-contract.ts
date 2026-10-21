import { productResultValidation as result, type ProductionRoutePolicy,
  type WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";

/** Only published mechanical structure and locked identities; professional admission belongs to Website. */
export function parseZejiResult(task: WebsiteAgentTask, raw: string, route: ProductionRoutePolicy) {
  if (task.product_id !== "zeji_personal_selection" || task.product_id !== route.product_id
    || task.action_id !== route.action_id) throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const output = result.parseJsonObject(raw, "ZEJI_RESULT");
  if (route.relation_kind === "review") {
    if (output.decision !== "no_issue" && output.decision !== "issues") throw new Error("AGENT_REVIEW_DECISION_INVALID");
    result.array(output.issues, "AGENT_REVIEW_ISSUES_REQUIRED");
    return output;
  }
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.locked(output, task, ["requirement_manifest_ref", "requirement_manifest_hash"]);
  const schema = result.object(route.result_contract?.json_schema, "ZEJI_OUTPUT_CONTRACT_REQUIRED");
  const properties = result.object(schema.properties, "ZEJI_OUTPUT_CONTRACT_REQUIRED");
  for (const key of result.stringArray(schema.required, "ZEJI_OUTPUT_CONTRACT_REQUIRED")) {
    const rule = result.object(properties[key], "ZEJI_OUTPUT_CONTRACT_REQUIRED");
    if (rule.type === "string" && (typeof output[key] !== "string" || !output[key].trim().length)) {
      throw new Error(`ZEJI_RESULT_TEXT_REQUIRED:${key}`);
    }
    if (rule.type === "array") result.array(output[key], `ZEJI_RESULT_ARRAY_REQUIRED:${key}`, rule.minItems === 1);
    if (Array.isArray(rule.enum) && !rule.enum.includes(output[key])) throw new Error(`ZEJI_RESULT_ENUM_INVALID:${key}`);
  }
  return output;
}
