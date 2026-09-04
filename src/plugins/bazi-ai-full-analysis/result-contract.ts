import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { productResultValidation as result } from "../../mediator/product-plugin-contract.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown, route: ProductionRoutePolicy): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "bazi_ai_full_analysis") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (route.relation_kind === "review") {
    if (!("decision" in output) || !("issues" in output)) throw new Error("AGENT_REVIEW_OUTPUT_INCOMPLETE");
    return Object.freeze(output);
  }
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  return Object.freeze(output);
};
