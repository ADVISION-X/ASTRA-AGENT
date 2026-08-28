import type { WebsiteAgentTask } from "../../lib/local-runtime/production/contracts.js";
import { productResultValidation as result } from "../../lib/local-runtime/production/plugin.js";
import { productionRoutePolicy } from "../../lib/local-runtime/production/route-policy.js";

const productIds = new Set(["localization_report_translation", "localization_article_translation"]);

export const parseProductResult = (task: WebsiteAgentTask, value: unknown): Readonly<Record<string, unknown>> => {
  if (!productIds.has(task.product_id)) throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  const route = productionRoutePolicy(task.product_id, task.action_id);
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "action_id", "source_resource_id", "source_version", "source_sha256", "target_locale", "localized_structured_payload"], "LOCALIZATION_RESULT_FIELDS_INVALID");
  if (output.action_id !== task.product_id) throw new Error("LOCALIZATION_ACTION_ID_INVALID");
  result.locked(output, task, ["source_resource_id", "source_version", "source_sha256", "target_locale"]);
  return Object.freeze(output);
};

export const parseRouteResult = (task: WebsiteAgentTask, raw: string): Readonly<Record<string, unknown>> =>
  parseProductResult(task, result.parseJsonObject(raw, "AGENT_ROUTE_RESULT"));
