/**
 * In-memory ability result proof summary registry.
 * Used by workbench to track ability output refs across dispatch chain.
 */

export type AbilityResultProofSummary = Record<string, string | number | boolean | null>;

export type AbilityResultContractSnapshot = {
  outputRef: string;
  abilityGroupId: string;
  childCapabilityId?: string | null;
  status: "success" | "failed" | "review_required";
  output?: unknown | null;
  runtimeProof?: unknown | null;
  failureReason?: string | { code?: string; message?: string; detail?: string | null } | null;
  reviewRequiredReason?: string | null;
};

const abilityResultProofSummaries = new Map<string, AbilityResultProofSummary>();
const abilityResultContractSnapshots = new Map<string, AbilityResultContractSnapshot>();

export function recordAbilityResultProofSummary(outputRef: string, summary: AbilityResultProofSummary): void {
  abilityResultProofSummaries.set(outputRef, summary);
}

export function recordAbilityResultContractSnapshot(outputRef: string, snapshot: AbilityResultContractSnapshot): void {
  abilityResultContractSnapshots.set(outputRef, snapshot);
}

export function resolveAbilityResultProofSummary(outputRef: string): AbilityResultProofSummary | null {
  return abilityResultProofSummaries.get(outputRef) ?? null;
}

export function resolveAbilityResultContractSnapshot(outputRef: string): AbilityResultContractSnapshot | null {
  return abilityResultContractSnapshots.get(outputRef) ?? null;
}
