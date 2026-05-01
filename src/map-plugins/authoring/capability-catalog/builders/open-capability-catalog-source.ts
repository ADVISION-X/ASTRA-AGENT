import { createOpenRegistry } from "../../../../capabilities/open/index.js";

export const listMapPluginOpenCatalogEntries = () => {
  const registry = createOpenRegistry();
  return [...registry.keys()].map((childCapabilityId) => ({
    childCapabilityId,
    child: registry.get(childCapabilityId),
  }));
};