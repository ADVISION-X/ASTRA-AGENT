import type { MissionCommand, OperationalMap } from "../contract.js";
import type { ActiveOperationalMapRecord, OrchestrationMapStorePort } from "../ports/orchestration-map-store-port.js";
import { OperationalMapSchema } from "../schema.js";

export type SelectedMapSource =
  | "preferred_map_id"
  | "initial_payload_map_id"
  | "task_template_id"
  | "activation_id"
  | "rejected_missing";

export type MapSelectionResult =
  | { selected: true; map: OperationalMap; record: ActiveOperationalMapRecord; selectedMapSource: Exclude<SelectedMapSource, "rejected_missing"> }
  | { selected: false; selectedMapSource: "rejected_missing"; failureReason: string };

function toSelectedMapResult(record: ActiveOperationalMapRecord, selectedMapSource: Exclude<SelectedMapSource, "rejected_missing">): MapSelectionResult {
  return {
    selected: true,
    map: OperationalMapSchema.parse(record.operationalMap),
    record,
    selectedMapSource,
  };
}

async function resolveMapSelectionCandidate(input: {
  mapStore: OrchestrationMapStorePort;
  source: Exclude<SelectedMapSource, "rejected_missing">;
  lookup: () => Promise<ActiveOperationalMapRecord | null>;
  failureReason: string;
}): Promise<MapSelectionResult> {
  const record = await input.lookup();
  if (!record) {
    return {
      selected: false,
      selectedMapSource: "rejected_missing",
      failureReason: input.failureReason,
    };
  }

  return toSelectedMapResult(record, input.source);
}

export async function selectOperationalMap(input: {
  command: MissionCommand;
  mapStore: OrchestrationMapStorePort;
}): Promise<MapSelectionResult> {
  if (input.command.preferredMapId) {
    return resolveMapSelectionCandidate({
      mapStore: input.mapStore,
      source: "preferred_map_id",
      lookup: () => input.mapStore.getActiveMapRecord(input.command.preferredMapId!),
      failureReason: `Preferred map id "${input.command.preferredMapId}" is not registered.`,
    });
  }

  if (input.command.initialPayload.selectedMapId) {
    return resolveMapSelectionCandidate({
      mapStore: input.mapStore,
      source: "initial_payload_map_id",
      lookup: () => input.mapStore.getActiveMapRecord(input.command.initialPayload.selectedMapId!),
      failureReason: `Initial payload map id "${input.command.initialPayload.selectedMapId}" is not registered.`,
    });
  }

  if (input.command.taskTemplateId) {
    return resolveMapSelectionCandidate({
      mapStore: input.mapStore,
      source: "task_template_id",
      lookup: () => input.mapStore.getActiveMapRecordByTaskTemplateId(input.command.taskTemplateId!),
      failureReason: `Task template id "${input.command.taskTemplateId}" is not bound to an active approved map.`,
    });
  }

  if (input.command.activationId) {
    return resolveMapSelectionCandidate({
      mapStore: input.mapStore,
      source: "activation_id",
      lookup: () => input.mapStore.getActiveMapRecordByActivationId(input.command.activationId!),
      failureReason: `Activation id "${input.command.activationId}" is not bound to an active approved map.`,
    });
  }

  return {
    selected: false,
    selectedMapSource: "rejected_missing",
    failureReason: "No active approved map binding could be determined from preferredMapId, initialPayload.selectedMapId, taskTemplateId, or activationId.",
  };
}
