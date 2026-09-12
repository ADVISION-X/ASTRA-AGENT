import { productRouteCatalogSnapshot, productionCatalogHash } from "../../../mediator/product-plugin-catalog.js";
import {
  RESULT_CONTRACT_VERSION,
  TASK_CONTRACT_VERSION,
  AgentRouteCapabilityManifestSchema,
  type AgentRouteCapabilityManifest,
} from "./contracts.js";

const manifestRoutes = productRouteCatalogSnapshot.map((route) => Object.freeze({
  product_id: route.product_id,
  action_id: route.action_id,
  task_contract_version: TASK_CONTRACT_VERSION,
  result_contract_version: RESULT_CONTRACT_VERSION,
}));

export { productionCatalogHash };

export const agentRouteCapabilityManifest: AgentRouteCapabilityManifest = Object.freeze(
  AgentRouteCapabilityManifestSchema.parse({
    schema_version: "agent-route-capability-manifest.v1",
    route_hash: productionCatalogHash,
    routes: Object.freeze(manifestRoutes),
  }),
);

export const appShellProductionPluginSupport = Object.freeze(
  agentRouteCapabilityManifest.routes.map((route) => Object.freeze({
    product_id: route.product_id,
    action_id: route.action_id,
    task_contract_version: route.task_contract_version,
    result_contract_version: route.result_contract_version,
  })),
);

if (manifestRoutes.length !== 40) {
  throw new Error("PLUGIN_MANIFEST_DENOMINATOR_INVALID");
}
