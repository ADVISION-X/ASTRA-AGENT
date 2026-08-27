import { baziAiFullAnalysisPlugin } from "../../../plugins/bazi-ai-full-analysis/index.js";
import { baziChartInterpretationPlugin } from "../../../plugins/bazi-chart-interpretation/index.js";
import { baziReportFollowupPlugin } from "../../../plugins/bazi-report-followup/index.js";
import { hehunAiAnalysisPlugin } from "../../../plugins/hehun-ai-analysis/index.js";
import { hehunReportFollowupPlugin } from "../../../plugins/hehun-report-followup/index.js";
import { localizationProductionPlugin } from "../../../plugins/localization-production/index.js";
import { namingBaziAnalysisAndNamingPlugin } from "../../../plugins/naming-bazi-analysis-and-naming/index.js";
import { namingFromExistingBaziReportPlugin } from "../../../plugins/naming-from-existing-bazi-report/index.js";
import { paymentScreenshotObservationPlugin } from "../../../plugins/payment-screenshot-observation/index.js";
import { publicKnowledgeArticlePipelinePlugin } from "../../../plugins/public-knowledge-article-pipeline/index.js";
import { qimenProfessionalAnswerPlugin } from "../../../plugins/qimen-professional-answer/index.js";
import { qimenReportFollowupPlugin } from "../../../plugins/qimen-report-followup/index.js";
import {
  RESULT_CONTRACT_VERSION,
  TASK_CONTRACT_VERSION,
  AgentPluginCapabilityManifestSchema,
  hashCanonical,
  type AgentPluginCapabilityManifest,
  type ProductionActionId,
  type ProductionProductId,
} from "./contracts.js";
import type { ProductPlugin } from "./plugin.js";
import { readProductSkill } from "./plugin.js";
import { productionRoutePolicyMap } from "./route-policy.js";

export const productionPluginCatalog = Object.freeze([
  baziChartInterpretationPlugin,
  baziAiFullAnalysisPlugin,
  baziReportFollowupPlugin,
  qimenProfessionalAnswerPlugin,
  qimenReportFollowupPlugin,
  hehunAiAnalysisPlugin,
  hehunReportFollowupPlugin,
  namingBaziAnalysisAndNamingPlugin,
  namingFromExistingBaziReportPlugin,
  publicKnowledgeArticlePipelinePlugin,
  localizationProductionPlugin,
  paymentScreenshotObservationPlugin,
] as const satisfies readonly ProductPlugin[]);

const skillBytes = new Map(productionPluginCatalog.map((plugin) => {
  const skill = readProductSkill(new URL(`../../../plugins/${plugin.pluginId}/index.js`, import.meta.url).href);
  if (skill.hash !== plugin.skillHash) throw new Error(`PLUGIN_SKILL_HASH_MISMATCH:${plugin.pluginId}`);
  return [plugin.pluginId, skill] as const;
}));

const routeKey = (productId: ProductionProductId, actionId: ProductionActionId): string =>
  `${productId}\0${actionId}`;

const routeCatalog = new Map<string, ProductPlugin>();
for (const plugin of productionPluginCatalog) {
  if (plugin.accepts.length < 1) throw new Error(`PLUGIN_ROUTE_EMPTY:${plugin.pluginId}`);
  if (!Number.isSafeInteger(plugin.checkpointSchemaVersion) || plugin.checkpointSchemaVersion < 1) {
    throw new Error(`PLUGIN_CHECKPOINT_SCHEMA_VERSION_INVALID:${plugin.pluginId}`);
  }
  for (const route of plugin.accepts) {
    const key = routeKey(route.productId, route.actionId);
    if (routeCatalog.has(key)) throw new Error(`PLUGIN_ROUTE_DUPLICATE:${route.productId}:${route.actionId}`);
    routeCatalog.set(key, plugin);
  }
}

const manifestPlugins = productionPluginCatalog.map((plugin) => ({
  plugin_id: plugin.pluginId,
  plugin_version: plugin.pluginVersion,
  accepts: plugin.accepts.map((route) => ({
    product_id: route.productId,
    action_id: route.actionId,
  })),
  task_contract_version: TASK_CONTRACT_VERSION,
  result_contract_version: RESULT_CONTRACT_VERSION,
}));

export const productionCatalogHash = hashCanonical(manifestPlugins);

export const agentPluginCapabilityManifest: AgentPluginCapabilityManifest = Object.freeze(AgentPluginCapabilityManifestSchema.parse({
  schema_version: "agent-plugin-capability-manifest.v1",
  catalog_hash: productionCatalogHash,
  plugins: Object.freeze(manifestPlugins),
}));

export const appShellProductionPluginSupport = Object.freeze(
  agentPluginCapabilityManifest.plugins.map((plugin) => Object.freeze({
    plugin_id: plugin.plugin_id,
    accepts: plugin.accepts,
    task_contract_version: plugin.task_contract_version,
    result_contract_version: plugin.result_contract_version,
  })),
);

export const resolveProductionPlugin = (
  productId: ProductionProductId,
  actionId: ProductionActionId,
): Readonly<{ plugin: ProductPlugin; skill_text: string; skill_hash: `sha256:${string}` }> => {
  const plugin = routeCatalog.get(routeKey(productId, actionId));
  if (!plugin) throw new Error(`PLUGIN_ROUTE_UNSUPPORTED:${productId}:${actionId}`);
  const skill = skillBytes.get(plugin.pluginId)!;
  return { plugin, skill_text: skill.text, skill_hash: skill.hash };
};

if (productionPluginCatalog.length !== 12 || skillBytes.size !== 12) {
  throw new Error("PLUGIN_CATALOG_DENOMINATOR_INVALID");
}
if (routeCatalog.size !== 39 || productionRoutePolicyMap.size !== 39
  || [...productionRoutePolicyMap.keys()].some((key) => !routeCatalog.has(key))) {
  throw new Error("PLUGIN_ROUTE_DENOMINATOR_INVALID");
}
