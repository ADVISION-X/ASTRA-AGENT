import type { PageStateObservation } from "../schema.js";

export function listObservationIds(observations: readonly PageStateObservation[]): string[] {
  return observations.map((observation) => observation.observationId);
}

export function findRuntimeSignal(
  observations: readonly PageStateObservation[],
  signalType: Extract<PageStateObservation, { kind: "runtime_signal" }>["payload"]["signalType"],
): Extract<PageStateObservation, { kind: "runtime_signal" }>[] {
  return observations.filter(
    (observation): observation is Extract<PageStateObservation, { kind: "runtime_signal" }> =>
      observation.kind === "runtime_signal" && observation.payload.signalType === signalType,
  );
}

export function findPageMarker(
  observations: readonly PageStateObservation[],
  marker: Extract<PageStateObservation, { kind: "page_marker" }>["payload"]["marker"],
): Extract<PageStateObservation, { kind: "page_marker" }>[] {
  return observations.filter(
    (observation): observation is Extract<PageStateObservation, { kind: "page_marker" }> =>
      observation.kind === "page_marker" && observation.payload.marker === marker,
  );
}

export function findVisualTargets(
  observations: readonly PageStateObservation[],
  targetType: Extract<PageStateObservation, { kind: "visual_target" }>["payload"]["targetType"],
): Extract<PageStateObservation, { kind: "visual_target" }>[] {
  return observations.filter(
    (observation): observation is Extract<PageStateObservation, { kind: "visual_target" }> =>
      observation.kind === "visual_target" && observation.payload.targetType === targetType,
  );
}

export function findPlatformCaptures(
  observations: readonly PageStateObservation[],
  captureKind: Extract<PageStateObservation, { kind: "platform_capture" }>["payload"]["captureKind"],
): Extract<PageStateObservation, { kind: "platform_capture" }>[] {
  return observations.filter(
    (observation): observation is Extract<PageStateObservation, { kind: "platform_capture" }> =>
      observation.kind === "platform_capture" && observation.payload.captureKind === captureKind,
  );
}