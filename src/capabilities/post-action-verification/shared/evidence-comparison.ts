import type { PostActionVerificationAbilityInput } from "../contract.js";

export function collectEvidenceRefs(input: PostActionVerificationAbilityInput): string[] {
  return [input.beforeEvidenceRef, input.afterEvidenceRef].filter((value): value is string => value !== null);
}

export function hasBeforeAfterEvidence(input: PostActionVerificationAbilityInput): boolean {
  return input.beforeEvidenceRef !== null && input.afterEvidenceRef !== null;
}