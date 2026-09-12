import type { ProductPlugin } from "../../mediator/product-plugin-contract.js";
import { executeOwnedFlow } from "./flow.js";
import { executeStaticCatalogFlow } from "./static-catalog-flow.js";

export const localizationProductionPlugin: ProductPlugin = {
  pluginId: "localization-production",
  accepts: [
    { productId: "localization_report_translation", actionId: "report_translation" },
    { productId: "localization_report_translation", actionId: "accuracy_challenge" },
    { productId: "localization_report_translation", actionId: "quality_reflection" },
    { productId: "localization_article_translation", actionId: "article_translation" },
    { productId: "localization_article_translation", actionId: "accuracy_challenge" },
    { productId: "localization_article_translation", actionId: "quality_reflection" },
    { productId: "localization_static_catalog", actionId: "produce_locale_catalog" },
  ],
  execute: (task, context) => task.product_id === "localization_static_catalog"
    ? executeStaticCatalogFlow(task, context)
    : executeOwnedFlow(task, context),
};
