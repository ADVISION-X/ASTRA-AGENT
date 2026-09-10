import { executionFailure, TypedExecutionFailure } from "../../lib/execution-failure.js";
import type {
  BrowserEffectFailureFacts,
  MutationOutcome,
} from "../../lib/browser/browser-authority-api.js";
import type { GptChildBrowserFact } from "./contract.js";
import type { GptReasoningRequirementResult } from "./child-types.js";

export const gptEvidenceFailureCause = (value: unknown): Error | undefined => {
  if (value === null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", "FORENSICS_EXACT_CALL_EVIDENCE_INVALID");
  }
  const cause = value as Readonly<Record<string, unknown>>;
  const name = cause.name;
  const code = cause.code;
  if (typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(name)
    || !(code === null || (typeof code === "string" && /^[A-Z][A-Za-z0-9_.:=-]{0,255}$/u.test(code)))) {
    throw executionFailure("failed", "FORENSICS_EXACT_CALL_EVIDENCE_INVALID");
  }
  return Object.assign(new Error(name), { name, ...(code ? { code } : {}) });
};

export type ProductSafeConfirmedProviderSubmitReceipt = Readonly<{
  exactCallIdentityHash: `sha256:${string}`;
  terminalAt: string;
  evidenceRef: string;
  evidenceHash: `sha256:${string}`;
}>;

class ConfirmedProviderSubmitReceiptError extends Error {
  public override readonly name = "ConfirmedProviderSubmitReceiptError";
  public constructor(
    cause: unknown,
    public readonly confirmedProviderSubmitReceipt: ProductSafeConfirmedProviderSubmitReceipt,
  ) {
    super("CONFIRMED_PROVIDER_SUBMIT_RECEIPT", { cause });
  }
}

export const carryProductSafeConfirmedProviderSubmitReceipt = (
  error: unknown,
  receipt: ProductSafeConfirmedProviderSubmitReceipt,
): unknown => {
  return new ConfirmedProviderSubmitReceiptError(error, Object.freeze(receipt));
};

export const confirmedProviderSubmitReceiptFromError = (
  error: unknown,
): ProductSafeConfirmedProviderSubmitReceipt | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof ConfirmedProviderSubmitReceiptError) {
      return current.confirmedProviderSubmitReceipt;
    }
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};

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
    public readonly reasoningRequirementResult: GptReasoningRequirementResult | null = null,
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
    reasoningRequirementResult?: GptReasoningRequirementResult | null;
    cause?: unknown;
  }> = {},
): GptExecutionFailure => new GptExecutionFailure(
  code,
  input.mutationOutcome,
  input.evidence,
  input.browserEffect,
  input.proofFacts,
  input.reasoningRequirementResult,
  input.cause,
);
