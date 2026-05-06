export type AbilityResultProofSummary = Record<string, string | number | boolean | null>;

const abilityResultProofSummaries = new Map<string, AbilityResultProofSummary>();

export function recordAbilityResultProofSummary(outputRef: string, summary: AbilityResultProofSummary): void {
  abilityResultProofSummaries.set(outputRef, summary);
}

export function resolveAbilityResultProofSummary(outputRef: string | null | undefined): AbilityResultProofSummary | null {
  return outputRef ? abilityResultProofSummaries.get(outputRef) ?? null : null;
}
