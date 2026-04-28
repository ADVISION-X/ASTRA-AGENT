import { validateOperationalMap } from "../../shared/map-types.js";
import { tiktokProductDiscoveryMap } from "./map.js";

export function verifyTikTokProductDiscoveryMap(): void {
  validateOperationalMap(tiktokProductDiscoveryMap);
  if (tiktokProductDiscoveryMap.mapId !== "tiktok-product-discovery-map") {
    throw new Error("tiktok-product-discovery-map metadata drift detected");
  }
}