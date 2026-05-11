import type { MissionCommand, OperationalMap } from "../contract.js";
import type { ActiveOperationalMapRecord, OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";

export type SelectedMapSource =
  | "preferred_map_id"
  | "rejected_missing";

export type MapSelectionResult =
  | { selected: true; map: OperationalMap; record: ActiveOperationalMapRecord; selectedMapSource: Exclude<SelectedMapSource, "rejected_missing"> }
  | { selected: false; selectedMapSource: "rejected_missing"; failureReason: string };

export async function selectOperationalMap(input: {
  command: MissionCommand;
  mapStore: OrchestrationMapStorePort;
}): Promise<MapSelectionResult> {
  void input.command;
  void input.mapStore;

  return {
    selected: false,
    selectedMapSource: "rejected_missing",
    failureReason: "Retired operational-map resolution is blocked. Mission start must be prepared from userRequirementText, selectedPlatforms, and governed visual mission contracts before runtime execution.",
  };
}
