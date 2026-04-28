import type {
  PageStateObservationKind,
  PageStateObservationRef,
  PageStateAbilityInput,
} from "../contract.js";

export function getObservationByKind(
  input: PageStateAbilityInput,
  kind: PageStateObservationKind,
): PageStateObservationRef[] {
  return input.observationRefs.filter((observation) => observation.kind === kind);
}

export function readBooleanPayload(observation: PageStateObservationRef, key: string): boolean | null {
  const value = observation.payload?.[key];
  return typeof value === "boolean" ? value : null;
}

export function readStringPayload(observation: PageStateObservationRef, key: string): string | null {
  const value = observation.payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readStringArrayPayload(observation: PageStateObservationRef, key: string): string[] {
  const value = observation.payload?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

export function collectObservationRefIds(input: PageStateAbilityInput): string[] {
  return input.observationRefs.map((observation) => observation.ref);
}