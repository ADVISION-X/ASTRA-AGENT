import type { KnownGptRateLimitPreflightFact } from
  "./browser/exact-target/browser-gpt-rate-limit-preflight.js";

export type ExecutionFailureStatus = "failed";
export type ExecutionMutationOutcome = "no" | "dispatched" | "confirmed";
export type ProviderStoppedEmptyProof = Readonly<{
  firstObservedAt: string;
  terminalObservedAt: string;
  continuousMonotonicMs: number;
  observationCount: number;
  identityHash: `sha256:${string}`;
  terminalObservationRevisionHash: `sha256:${string}`;
}>;
export type ExactReadbackNegativeObservation = Readonly<{
  pendingCause: "exact-user-turn-unavailable" | "adjacent-assistant-missing";
  canonicalConversationUrl: string;
  userTurnId: string;
  targetRefHash: `sha256:${string}`;
  documentRefHash: `sha256:${string}`;
  observationRevisionHash: `sha256:${string}`;
  observedAt: string;
  generatingRaw: number;
  firstObservedAt: string;
  observationCount: number;
}>;
export type ExecutionFailureMetadata = Readonly<{
  mutationOutcome?: ExecutionMutationOutcome;
  evidence?: Readonly<{ evidenceRef: string; evidenceHash: `sha256:${string}` }> | null;
  browserEffect?: Readonly<{
    effectScope: "target_local" | "provider_effect";
    childCapabilityId: string;
    browserOutcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
    providerEffectIdentityHash?: `sha256:${string}` | null;
  }> | null;
  settledResultPayloadHash?: `sha256:${string}` | null;
  stoppedEmptyProof?: ProviderStoppedEmptyProof | null;
  childProof?: Readonly<{ evidenceRef: string; evidenceHash: `sha256:${string}` }> | null;
  knownGptRateLimitPreflightFact?: KnownGptRateLimitPreflightFact | null;
  exactReadbackNegativeObservation?: ExactReadbackNegativeObservation | null;
  knownGptDialogAuthority?: Readonly<{
    evidenceRef: string;
    evidenceHash: `sha256:${string}`;
  }> | null;
}>;

export class TypedExecutionFailure extends Error {
  public override readonly name: string = "TypedExecutionFailure";

  public constructor(
    public readonly status: ExecutionFailureStatus,
    public readonly code: string,
    cause?: unknown,
    public readonly metadata: ExecutionFailureMetadata = Object.freeze({}),
  ) {
    super(code, cause === undefined ? undefined : { cause });
  }
}

export const executionFailure = (
  status: ExecutionFailureStatus,
  code: string,
  input: Readonly<{ cause?: unknown; metadata?: ExecutionFailureMetadata }> = {},
): TypedExecutionFailure => new TypedExecutionFailure(status, code, input.cause, input.metadata);

export const typedExecutionFailure = (error: unknown): TypedExecutionFailure | null => {
  let current = error;
  let typed: TypedExecutionFailure | null = null;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof TypedExecutionFailure) typed = current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return typed;
};

export const failureCode = (error: unknown, fallback = "UNKNOWN_FAILURE"): string =>
  typedExecutionFailure(error)?.code ?? fallback;

export const executionFailureMetadata = (error: unknown): ExecutionFailureMetadata | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof TypedExecutionFailure && Object.keys(current.metadata).length > 0) {
      return current.metadata;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};

export const exactReadbackNegativeObservation = (
  error: unknown,
): ExactReadbackNegativeObservation | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof TypedExecutionFailure
      && current.metadata.exactReadbackNegativeObservation) {
      return current.metadata.exactReadbackNegativeObservation;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};

export const oldTargetUnavailableFact = (
  error: unknown,
): Readonly<{ jobRefHash: `sha256:${string}`; targetRefHash: `sha256:${string}`;
  proofHash: `sha256:${string}` }> | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const fact = "oldTargetUnavailableFact" in current ? current.oldTargetUnavailableFact : null;
    if (fact && typeof fact === "object" && "jobRefHash" in fact
      && "targetRefHash" in fact && "proofHash" in fact
      && [fact.jobRefHash, fact.targetRefHash, fact.proofHash]
        .every((value) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value))) {
      return fact as Readonly<{ jobRefHash: `sha256:${string}`;
        targetRefHash: `sha256:${string}`; proofHash: `sha256:${string}` }>;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};

export const executionFailureCause = (
  error: unknown,
): Readonly<{ name: string; code: string | null }> | null => {
  const typed = typedExecutionFailure(error);
  let current = typed ? typed.cause : error;
  let deepest: Error | null = null;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) deepest = current;
    current = current instanceof Error ? current.cause : undefined;
  }
  if (!deepest) return null;
  const code = "code" in deepest && typeof deepest.code === "string" ? deepest.code
    : deepest.message !== typed?.code && /^[A-Z][A-Z0-9_]+$/u.test(deepest.message) ? deepest.message : null;
  return Object.freeze({ name: deepest.name || "Error", code });
};
