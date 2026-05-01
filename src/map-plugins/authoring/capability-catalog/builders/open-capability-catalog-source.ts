import { createOpenRegistry, listOpenChildren } from "../../../../capabilities/open/index.js";

export const listMapPluginOpenCatalogEntries = () => {
  const registry = createOpenRegistry();
  return listOpenChildren().map((childCapabilityId) => ({
    childCapabilityId,
    child: registry.get(childCapabilityId),
  }));
};