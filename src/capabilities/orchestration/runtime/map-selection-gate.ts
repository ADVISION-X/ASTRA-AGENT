import type { MissionCommand, OperationalMap } from "../contract.js";
import { OperationalMapSchema } from "../schema.js";
import type { OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";

export async function selectOperationalMap(input: {
  command: MissionCommand;
  mapStore: OrchestrationMapStorePort;
}): Promise<OperationalMap> {
  const selectedMapId = input.command.preferredMapId
    ?? input.command.initialPayload.selectedMapId
    ?? (input.command.requestedPlatform === "facebook-web" ? "recovery" : "product-video-detection");
  const map = await input.mapStore.getMap(selectedMapId);
  if (!map) {
    throw new Error(`Operational map is not registered for ${selectedMapId}.`);
  }
  return OperationalMapSchema.parse(map);
}

export function createStaticOrchestrationMapStore(maps: readonly OperationalMap[]): OrchestrationMapStorePort {
  const mapById = new Map(maps.map((map) => [map.mapId, map]));
  return {
    async getMap(mapId) {
      return mapById.get(mapId) ?? null;
    },
    async listMaps() {
      return maps;
    },
  };
}