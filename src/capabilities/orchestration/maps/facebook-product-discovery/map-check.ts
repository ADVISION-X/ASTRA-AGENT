import { validateOperationalMap } from "../../shared/map-types.js";
import { facebookProductDiscoveryMap } from "./map.js";

export function verifyFacebookProductDiscoveryMap(): void {
  validateOperationalMap(facebookProductDiscoveryMap);
  if (facebookProductDiscoveryMap.mapId !== "facebook-product-discovery-map") {
    throw new Error("facebook-product-discovery-map metadata drift detected");
  }
}