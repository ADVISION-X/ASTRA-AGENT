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

export function findRawRuntimeSignal(
  observations: readonly PageStateObservation[],
  signalName: string,
): Extract<PageStateObservation, { kind: "raw_runtime_signal" }>[] {
  return observations.filter(
    (observation): observation is Extract<PageStateObservation, { kind: "raw_runtime_signal" }> =>
      observation.kind === "raw_runtime_signal" && observation.payload.signalName === signalName,
  );
}
