import type { OperationalMap, OperationalMapId } from "./shared/map-types.js";
import { facebookProductDiscoveryMap } from "./maps/facebook-product-discovery/map.js";
import { tiktokProductDiscoveryMap } from "./maps/tiktok-product-discovery/map.js";

export function createOperationalMapRegistry(): Map<OperationalMapId, OperationalMap> {
  return new Map<OperationalMapId, OperationalMap>([
    [facebookProductDiscoveryMap.mapId, facebookProductDiscoveryMap],
    [tiktokProductDiscoveryMap.mapId, tiktokProductDiscoveryMap],
  ]);
}