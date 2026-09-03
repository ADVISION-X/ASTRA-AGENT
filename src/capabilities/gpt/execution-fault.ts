import { TypedExecutionFailure } from "../../lib/execution-failure.js";
import type {
  BrowserEffectFailureFacts,
  MutationOutcome,
} from "../../lib/browser/browser-authority-api.js";
import type { GptChildBrowserFact } from "./contract.js";

export type GptFailureProofFacts = Readonly<{
  decision: "DONE" | "ACT" | "WAIT" | "FAIL_CLOSED";
  factResultIds: readonly string[];
  candidateCardinality: Readonly<{ raw: number | null; eligible: number | null }>;
  authorityRefHashes: readonly `sha256:${string}`[];
  observationRevisionHash: `sha256:${string}` | null;
  mutationOutcome: "no" | "dispatched" | "confirmed";
  browserFact: GptChildBrowserFact | null;
  nativeFailureCode: string | null;
}>;

class GptExecutionFailure extends TypedExecutionFailure {
  public override readonly name: string = "GptExecutionFailure";

  public constructor(
    code: string,
    public readonly mutationOutcome: MutationOutcome = "no",
    public readonly evidence: Readonly<{
      evidenceRef: string;
      evidenceHash: `sha256:${string}`;
    }> | null = null,
    public readonly browserEffect: BrowserEffectFailureFacts | null = null,
    public readonly proofFacts: GptFailureProofFacts | null = null,
    cause?: unknown,
  ) {
    super("failed", code, cause, Object.freeze({ mutationOutcome, evidence, browserEffect, proofFacts }));
  }
}

export const typedGptExecutionFailure = (error: unknown): GptExecutionFailure | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof GptExecutionFailure) return current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};

export const gptExecutionFailure = (
  code: string,
  input: Readonly<{
    mutationOutcome?: MutationOutcome;
    evidence?: Readonly<{ evidenceRef: string; evidenceHash: `sha256:${string}` }> | null;
    browserEffect?: BrowserEffectFailureFacts | null;
    proofFacts?: GptFailureProofFacts | null;
    cause?: unknown;
  }> = {},
): GptExecutionFailure => new GptExecutionFailure(
  code,
  input.mutationOutcome,
  input.evidence,
  input.browserEffect,
  input.proofFacts,
  input.cause,
);
