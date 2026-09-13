import { productPluginCatalogSnapshot, productionCatalogHash } from "../../../mediator/product-plugin-catalog.js";
import {
  RESULT_CONTRACT_VERSION,
  TASK_CONTRACT_VERSION,
  AgentRouteCapabilityManifestSchema,
  type AgentRouteCapabilityManifest,
} from "./contracts.js";

const manifestRoutes = productPluginCatalogSnapshot.map((route) => Object.freeze({
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

if (manifestRoutes.length !== 40) {
  throw new Error("PLUGIN_MANIFEST_DENOMINATOR_INVALID");
}
