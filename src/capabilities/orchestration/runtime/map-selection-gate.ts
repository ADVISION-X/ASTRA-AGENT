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

export async function selectOperationalMap(input: {
  command: MissionCommand;
  mapStore: OrchestrationMapStorePort;
}): Promise<MapSelectionResult> {
  if (input.command.preferredMapId) {
    const record = await input.mapStore.getActiveMapRecord(input.command.preferredMapId);
    if (!record) {
      return {
        selected: false,
        selectedMapSource: "rejected_missing",
        failureReason: `Preferred map id "${input.command.preferredMapId}" is not registered.`,
      };
    }
    return toSelectedMapResult(record, "preferred_map_id");
  }

  if (input.command.initialPayload.selectedMapId) {
    const record = await input.mapStore.getActiveMapRecord(input.command.initialPayload.selectedMapId);
    if (!record) {
      return {
        selected: false,
        selectedMapSource: "rejected_missing",
        failureReason: `Initial payload map id "${input.command.initialPayload.selectedMapId}" is not registered.`,
      };
    }
    return toSelectedMapResult(record, "initial_payload_map_id");
  }

  if (input.command.taskTemplateId) {
    const record = await input.mapStore.getActiveMapRecordByTaskTemplateId(input.command.taskTemplateId);
    if (!record) {
      return {
        selected: false,
        selectedMapSource: "rejected_missing",
        failureReason: `Task template id "${input.command.taskTemplateId}" is not bound to an active approved map.`,
      };
    }
    return toSelectedMapResult(record, "task_template_id");
  }

  if (input.command.activationId) {
    const record = await input.mapStore.getActiveMapRecordByActivationId(input.command.activationId);
    if (!record) {
      return {
        selected: false,
        selectedMapSource: "rejected_missing",
        failureReason: `Activation id "${input.command.activationId}" is not bound to an active approved map.`,
      };
    }
    return toSelectedMapResult(record, "activation_id");
  }

  return {
    selected: false,
    selectedMapSource: "rejected_missing",
    failureReason: "No active approved map binding could be determined from preferredMapId, initialPayload.selectedMapId, taskTemplateId, or activationId.",
  };
}
