import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

export const parseProductResult = (task: WebsiteAgentTask, value: unknown): Readonly<Record<string, unknown>> => {
  if (task.product_id !== "payment_screenshot_observation") throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "page_kind", "payment_app", "success_visible", "visible_amount_minor_units", "reason_code"], "PAYMENT_OBSERVATION_FIELDS_INVALID");
  if (!["payment_success", "other"].includes(String(output.page_kind))
    || !["alipay", "wechat", "unknown"].includes(String(output.payment_app))
    || typeof output.success_visible !== "boolean"
    || !(output.visible_amount_minor_units === null || Number.isSafeInteger(output.visible_amount_minor_units))) {
    throw new Error("PAYMENT_OBSERVATION_INVALID");
  }
  result.text(output.reason_code, "PAYMENT_OBSERVATION_REASON_INVALID");
  return Object.freeze(output);
};
