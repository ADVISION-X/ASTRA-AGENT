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

export function recordAbilityResultContractSnapshot(outputRef: string, snapshot: Omit<AbilityResultContractSnapshot, "outputRef">): void {
  abilityResultContractSnapshots.set(outputRef, {
    outputRef,
    ...snapshot,
  });
}

export function resolveAbilityResultProofSummary(outputRef: string | null | undefined): AbilityResultProofSummary | null {
  return outputRef ? abilityResultProofSummaries.get(outputRef) ?? null : null;
}

export function resolveAbilityResultContractSnapshot(outputRef: string | null | undefined): AbilityResultContractSnapshot | null {
  return outputRef ? abilityResultContractSnapshots.get(outputRef) ?? null : null;
}
