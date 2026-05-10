import type { VisualMissionPlatformId } from "./platform-target-registry.js";

export const VISUAL_MISSION_RUNTIME_ID = "visual-mission-runtime-v1";
export const VISUAL_MISSION_RUNTIME_ENVELOPE_MAP_ID = "visual-mission-runtime-envelope";
export const VISUAL_MISSION_RUNTIME_ACTIVATION_ID = VISUAL_MISSION_RUNTIME_ID;

export type VisualMissionRuntimeCompatibilityEnvelope = {
  selectedMapId: typeof VISUAL_MISSION_RUNTIME_ENVELOPE_MAP_ID;
  taskTemplateId: string;
  activationSnapshotRef: string;
};

export const isVisualMissionRuntimeEnvelopeMapId = (value: string | null | undefined): boolean =>
  value === VISUAL_MISSION_RUNTIME_ENVELOPE_MAP_ID;

export const buildVisualMissionTaskTemplateId = (platformId: VisualMissionPlatformId): string =>
  `visual-mission-runtime:${platformId}`;

export const buildVisualMissionActivationSnapshotRef = (platformId: VisualMissionPlatformId): string =>
  `${VISUAL_MISSION_RUNTIME_ENVELOPE_MAP_ID}:${platformId}:generated`;

export const buildVisualMissionRuntimeCompatibilityEnvelope = (
  platformId: VisualMissionPlatformId,
): VisualMissionRuntimeCompatibilityEnvelope => ({
  selectedMapId: VISUAL_MISSION_RUNTIME_ENVELOPE_MAP_ID,
  taskTemplateId: buildVisualMissionTaskTemplateId(platformId),
  activationSnapshotRef: buildVisualMissionActivationSnapshotRef(platformId),
});