import { VisualMissionActionPlanRequestInputSchema } from "../../types/visual-mission-action-plan.js";

import {
  payloadDocumentToObject,
  payloadValueToString,
} from "./workbench-payload.js";

const parseJsonValue = <T>(rawValue: string | null, fieldName: string): T => {
  if (!rawValue) {
    throw new Error(`Workbench visual mission request is missing ${fieldName}.`);
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    throw new Error(`Workbench visual mission request has invalid ${fieldName}.`);
  }
};

export function buildWorkbenchVisualMissionActionPlanInput(
  inputPayload: Parameters<typeof payloadDocumentToObject>[0],
) {
  const payload = payloadDocumentToObject(inputPayload);
  return VisualMissionActionPlanRequestInputSchema.parse({
    userRequirementRef: payloadValueToString(payload.userRequirementRef),
    userRequirementText: payloadValueToString(payload.userRequirementText),
    systemManualRef: payloadValueToString(payload.systemManualRef),
    outputSchemaRef: payloadValueToString(payload.outputSchemaRef),
    originalScreenshotRef: payloadValueToString(payload.originalScreenshotRef),
    coordinateGridScreenshotRef: payloadValueToString(payload.coordinateGridScreenshotRef),
    gridSpecRef: payloadValueToString(payload.gridSpecRef),
    platformContextRef: payloadValueToString(payload.platformContextRef),
    platformContext: parseJsonValue(payloadValueToString(payload.platformContextJson), "platformContextJson"),
    roundMissionPacketRef: payloadValueToString(payload.roundMissionPacketRef),
    roundMissionPacket: parseJsonValue(payloadValueToString(payload.roundMissionPacketJson), "roundMissionPacketJson"),
  });
}
