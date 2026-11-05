import { readFileSync } from "node:fs";
import { paperFactoryPlugin } from "../plugins/s00-paper-factory/index.js";
import { paymentScreenshotObservationPlugin } from "../plugins/payment-screenshot-observation/index.js";
import { hashCanonical, sha256, type ProductDispatchContext, type ProductPlugin,
  type ProductSkill, type WebsiteAgentTask } from "./product-plugin-contract.js";

export const productionPluginCatalog = Object.freeze([
  paperFactoryPlugin, paymentScreenshotObservationPlugin,
] satisfies readonly ProductPlugin[]);
const routes = new Map<string, ProductPlugin>();
const skills = new Map<string, ProductSkill>();
for (const plugin of productionPluginCatalog) {
  const text = readFileSync(new URL(`../plugins/${plugin.pluginId}/SKILL.md`, import.meta.url), "utf8").normalize("NFC");
  if (!text.trim() || plugin.accepts.length === 0) throw new Error("PLUGIN_DEFINITION_INVALID");
  skills.set(plugin.pluginId, Object.freeze({ text, hash: sha256(text) }));
  for (const route of plugin.accepts) {
    const key = `${route.productId}\0${route.actionId}`;
    if (routes.has(key)) throw new Error("PLUGIN_ROUTE_DUPLICATE");
    routes.set(key, plugin);
  }
}
export const productPluginCatalogSnapshot = Object.freeze(productionPluginCatalog.flatMap(plugin =>
  plugin.accepts.map(route => Object.freeze({ product_id: route.productId, action_id: route.actionId }))));
export const productionCatalogHash = hashCanonical(productPluginCatalogSnapshot.map(route => ({
  ...route, task_contract_version: 1, result_contract_version: 1,
})));
export function assertProductRouteSupported(product: string, action: string): void {
  if (!routes.has(`${product}\0${action}`)) throw new Error(`PLUGIN_ROUTE_UNSUPPORTED:${product}:${action}`);
}
export function dispatchProductPlugin(task: WebsiteAgentTask, context: ProductDispatchContext) {
  const plugin = routes.get(`${task.product_id}\0${task.action_id}`);
  if (!plugin) throw new Error(`PLUGIN_ROUTE_UNSUPPORTED:${task.product_id}:${task.action_id}`);
  return plugin.execute(task, { ...context, productSkill: skills.get(plugin.pluginId)! });
}
