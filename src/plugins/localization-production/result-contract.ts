import type { ProductionRoutePolicy, WebsiteAgentTask } from "../../mediator/product-plugin-contract.js";
import { productResultValidation as result } from "../../mediator/product-plugin-contract.js";

const productIds = new Set(["localization_report_translation", "localization_article_translation"]);

export const parseProductResult = (task: WebsiteAgentTask, value: unknown, route: ProductionRoutePolicy): Readonly<Record<string, unknown>> => {
  if (!productIds.has(task.product_id)) throw new Error("PRODUCT_RESULT_OWNER_MISMATCH");
  if (route.relation_kind === "review") return result.parseReview(JSON.stringify(value));
  const output = result.object(value, "AGENT_RESULT_OBJECT_REQUIRED");
  if (output.schema_version !== route.result_schema_version) throw new Error("AGENT_RESULT_SCHEMA_VERSION_INVALID");
  result.exact(output, ["schema_version", "action_id", "source_resource_id", "source_version", "source_sha256", "target_locale", "localized_structured_payload"], "LOCALIZATION_RESULT_FIELDS_INVALID");
  if (output.action_id !== task.product_id) throw new Error("LOCALIZATION_ACTION_ID_INVALID");
  result.locked(output, task, ["source_resource_id", "source_version", "source_sha256", "target_locale"]);
  return Object.freeze(output);
};
