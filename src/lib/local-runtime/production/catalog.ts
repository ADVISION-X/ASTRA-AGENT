import {
  productPluginCatalogSnapshot,
  productionCatalogHash,
} from "../../../mediator/product-plugin-catalog.js";
import {
  RESULT_CONTRACT_VERSION,
  TASK_CONTRACT_VERSION,
  AgentPluginCapabilityManifestSchema,
  type AgentPluginCapabilityManifest,
} from "./contracts.js";

const manifestPlugins = productPluginCatalogSnapshot.map((plugin) => Object.freeze({
  plugin_id: plugin.plugin_id,
  plugin_version: plugin.plugin_version,
  accepts: plugin.accepts,
  task_contract_version: TASK_CONTRACT_VERSION,
  result_contract_version: RESULT_CONTRACT_VERSION,
}));

export { productionCatalogHash };

export const agentPluginCapabilityManifest: AgentPluginCapabilityManifest = Object.freeze(
  AgentPluginCapabilityManifestSchema.parse({
    schema_version: "agent-plugin-capability-manifest.v1",
    catalog_hash: productionCatalogHash,
    plugins: Object.freeze(manifestPlugins),
  }),
);

export const appShellProductionPluginSupport = Object.freeze(
  agentPluginCapabilityManifest.plugins.map((plugin) => Object.freeze({
    plugin_id: plugin.plugin_id,
    accepts: plugin.accepts,
    task_contract_version: plugin.task_contract_version,
    result_contract_version: plugin.result_contract_version,
  })),
);

if (manifestPlugins.length !== 12
  || manifestPlugins.reduce((count, plugin) => count + plugin.accepts.length, 0) !== 40) {
  throw new Error("PLUGIN_MANIFEST_DENOMINATOR_INVALID");
}
