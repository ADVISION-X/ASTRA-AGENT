import {
  TypedExecutionFailure,
  typedExecutionFailure,
  type ExecutionFailureMetadata,
} from "../execution-failure.js";

export type MutationOutcome = "no" | "dispatched" | "confirmed";
export type BrowserEffectFailureFacts = Readonly<{
  effectScope: "target_local" | "provider_effect";
  childCapabilityId: string;
  browserOutcome: "DISPATCHED" | "CONFIRMED" | "REJECTED";
  providerEffectIdentityHash?: `sha256:${string}` | null;
}>;

export class BrowserExecutionFailure extends TypedExecutionFailure {
  public override readonly name = "BrowserExecutionFailure";

  public constructor(
    code: string,
    public readonly mutationOutcome: MutationOutcome,
    public readonly browserEffect: BrowserEffectFailureFacts | null,
    cause?: unknown,
    metadata: ExecutionFailureMetadata = Object.freeze({}),
  ) {
    super("failed", code, cause, metadata);
  }
}

export const typedBrowserExecutionFailure = (error: unknown): BrowserExecutionFailure | null => {
  let current = error;
  const seen = new Set<object>();
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if (current instanceof BrowserExecutionFailure) return current;
    current = current instanceof Error ? current.cause : undefined;
  }
  return null;
};

export const browserExecutionFailure = (
  error: unknown,
  mutationOutcome?: MutationOutcome,
  browserEffect?: BrowserEffectFailureFacts | null,
): BrowserExecutionFailure => {
  const browser = typedBrowserExecutionFailure(error);
  if (browser && (!browserEffect || browser.browserEffect)) return browser;
  if (browser) return new BrowserExecutionFailure(
    browser.code,
    browser.mutationOutcome,
    browserEffect ?? null,
    browser.cause,
  );
  const existing = typedExecutionFailure(error);
  const code = error instanceof Error && error.message ? error.message : "BROWSER_FAILURE_UNCLASSIFIED";
  return new BrowserExecutionFailure(
    existing?.code ?? code,
    mutationOutcome ?? (code === "BROWSER_COMMAND_RECEIPT_MISSING" ? "dispatched" : "no"),
    browserEffect ?? null,
    existing?.cause ?? error,
    existing?.metadata,
  );
};
