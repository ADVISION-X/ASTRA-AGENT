import { readFileSync } from "node:fs";

import { baziAiFullAnalysisPlugin } from "../plugins/bazi-ai-full-analysis/index.js";
import { baziChartInterpretationPlugin } from "../plugins/bazi-chart-interpretation/index.js";
import { baziReportFollowupPlugin } from "../plugins/bazi-report-followup/index.js";
import { hehunAiAnalysisPlugin } from "../plugins/hehun-ai-analysis/index.js";
import { hehunReportFollowupPlugin } from "../plugins/hehun-report-followup/index.js";
import { localizationProductionPlugin } from "../plugins/localization-production/index.js";
import { namingCommercialPlugin } from "../plugins/naming-commercial/index.js";
import { namingFromExistingBaziReportPlugin } from "../plugins/naming-from-existing-bazi-report/index.js";
import { paymentScreenshotObservationPlugin } from "../plugins/payment-screenshot-observation/index.js";
import { publicKnowledgeArticlePipelinePlugin } from "../plugins/public-knowledge-article-pipeline/index.js";
import { qimenProfessionalAnswerPlugin } from "../plugins/qimen-professional-answer/index.js";
import { qimenReportFollowupPlugin } from "../plugins/qimen-report-followup/index.js";
import { zejiPersonalSelectionPlugin } from "../plugins/zeji-personal-selection/index.js";
import {
  hashCanonical,
  sha256,
  type ProductDispatchContext,
  type ProductPlugin,
  type ProductionActionId,
  type ProductionHash,
  type ProductionProductId,
  type WebsiteAgentTask,
} from "./product-plugin-contract.js";

export const productionPluginCatalog = Object.freeze([
  baziChartInterpretationPlugin,
  baziAiFullAnalysisPlugin,
  baziReportFollowupPlugin,
  qimenProfessionalAnswerPlugin,
  qimenReportFollowupPlugin,
  hehunAiAnalysisPlugin,
  hehunReportFollowupPlugin,
  namingCommercialPlugin,
  namingFromExistingBaziReportPlugin,
  publicKnowledgeArticlePipelinePlugin,
  localizationProductionPlugin,
  paymentScreenshotObservationPlugin,
  zejiPersonalSelectionPlugin,
] as const satisfies readonly ProductPlugin[]);

export interface ProductRouteCatalogEntry {
  readonly product_id: ProductionProductId;
  readonly action_id: ProductionActionId;
}

const routeKey = (productId: ProductionProductId, actionId: ProductionActionId): string =>
  `${productId}\0${actionId}`;

const routeCatalog = new Map<string, ProductPlugin>();
const skillBytes = new Map<string, Readonly<{ text: string; hash: ProductionHash }>>();
for (const plugin of productionPluginCatalog) {
  if (plugin.accepts.length < 1) throw new Error(`PLUGIN_ROUTE_EMPTY:${plugin.pluginId}`);
  const skillPath = new URL(`../plugins/${plugin.pluginId}/SKILL.md`, import.meta.url);
  const skillText = readFileSync(skillPath, "utf8").normalize("NFC");
  if (!skillText.trim()) throw new Error(`PLUGIN_SKILL_EMPTY:${plugin.pluginId}`);
  skillBytes.set(plugin.pluginId, Object.freeze({ text: skillText, hash: sha256(skillText) }));
  for (const route of plugin.accepts) {
    const key = routeKey(route.productId, route.actionId);
    if (routeCatalog.has(key)) throw new Error(`PLUGIN_ROUTE_DUPLICATE:${route.productId}:${route.actionId}`);
    routeCatalog.set(key, plugin);
  }
}

export const productPluginCatalogSnapshot: readonly ProductRouteCatalogEntry[] = Object.freeze(
  productionPluginCatalog.flatMap((plugin) => plugin.accepts.map((route) => Object.freeze({
    product_id: route.productId,
    action_id: route.actionId,
  }))),
);

const manifestProjection = productPluginCatalogSnapshot.map((route) => ({
  product_id: route.product_id,
  action_id: route.action_id,
  task_contract_version: 1,
  result_contract_version: 1,
}));

export const productionCatalogHash = hashCanonical(manifestProjection);

export const assertProductRouteSupported = (
  productId: ProductionProductId,
  actionId: ProductionActionId,
): void => {
  const plugin = routeCatalog.get(routeKey(productId, actionId));
  if (!plugin) throw new Error(`PLUGIN_ROUTE_UNSUPPORTED:${productId}:${actionId}`);
};

export const dispatchProductPlugin = (
  task: WebsiteAgentTask,
  context: ProductDispatchContext,
) => {
  const plugin = routeCatalog.get(routeKey(task.product_id, task.action_id));
  if (!plugin) throw new Error(`PLUGIN_ROUTE_UNSUPPORTED:${task.product_id}:${task.action_id}`);
  return plugin.execute(task, Object.freeze({
    ...context,
    productSkill: skillBytes.get(plugin.pluginId)!,
  }));
};

if (productionPluginCatalog.length !== 13 || skillBytes.size !== 13 || routeCatalog.size !== 43) {
  throw new Error("PLUGIN_CATALOG_DENOMINATOR_INVALID");
}
