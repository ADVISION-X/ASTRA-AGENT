import type {
  PostActionObservationKind,
  PostActionObservationRef,
  PostActionVerificationAbilityInput,
} from "../contract.js";

export function getObservationByKind(
  input: PostActionVerificationAbilityInput,
  kind: PostActionObservationKind,
): PostActionObservationRef[] {
  return input.observationRefs.filter((observation) => observation.kind === kind);
}

export function readBooleanPayload(observation: PostActionObservationRef, key: string): boolean | null {
  const value = observation.payload?.[key];
  return typeof value === "boolean" ? value : null;
}

export function readStringPayload(observation: PostActionObservationRef, key: string): string | null {
  const value = observation.payload?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function hasObservationSupport(input: PostActionVerificationAbilityInput): boolean {
  return input.observationRefs.length > 0
    || input.pageStateRef !== null
    || input.aiObservationRef !== null
    || input.visualTargetRef !== null
    || input.screenshotDiffRef !== null;
}

export function collectObservationRefIds(input: PostActionVerificationAbilityInput): string[] {
  return input.observationRefs.map((observation) => observation.ref);
}