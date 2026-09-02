import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "bazi_ai_full_analysis") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (route.relation_kind === "review") {
    if (!("decision" in output) || !("issues" in output)) throw new Error("AGENT_REVIEW_OUTPUT_INCOMPLETE");
    return Object.freeze(output);
  }
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  return Object.freeze(output);
};
