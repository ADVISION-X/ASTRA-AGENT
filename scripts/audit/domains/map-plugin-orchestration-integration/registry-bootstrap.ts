import { getDevelopmentMapPluginRegistry } from "../../../../src/map-plugins/registry/map-plugin-registry.js";

export function createBootstrappedRegistry() {
  return getDevelopmentMapPluginRegistry();
}