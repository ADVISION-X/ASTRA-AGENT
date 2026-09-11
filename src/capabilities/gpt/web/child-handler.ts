import {
  GPT_CHILD_CAPABILITY_CONTRACTS,
  gptExactCallIdentityHash,
  type GptChildBrowserFact,
  type GptChildCapabilityId,
  type GptChildCapabilityIntent,
  type GptChildOutputMap,
  type GptExecutionContext,
} from "../contract.js";
import { gptExecutionFailure } from "../execution-fault.js";
import { executionFailure } from "../../../lib/execution-failure.js";

type GptChildObservationValue<T> = Readonly<{
  value: T;
  decision: "DONE" | "ACT";
  factResultIds: readonly string[];
  candidateCardinality: Readonly<{ raw: number | null; eligible: number | null }>;
  authorityRefHashes: readonly `sha256:${string}`[];
  observationRevisionHash: `sha256:${string}` | null;
  mutationOutcome: "no" | "dispatched" | "confirmed";
  postconditionResult: "passed";
  browserFact: GptChildBrowserFact | null;
  nativeFailureCode: string | null;
}>;

type GptChildFactDeclaration = Omit<GptChildObservationValue<never>, "value" | "postconditionResult">;

export type GptChildObservation<K extends GptChildCapabilityId = GptChildCapabilityId> =
  GptChildObservationValue<GptChildOutputMap[K]>;

export type GptChildHandler<K extends GptChildCapabilityId> = (
  intent: GptChildCapabilityIntent<K>,
  context: GptExecutionContext,
) => Promise<GptChildObservation<K>>;

type ConfirmedGptChildBrowserFact<AllowsNo extends boolean> = Omit<
  GptChildBrowserFact, "browserOutcome" | "mutationOutcome"
> & Readonly<{
  browserOutcome: "CONFIRMED";
  mutationOutcome: AllowsNo extends true ? "no" | "confirmed" : "confirmed";
}>;

type GptInputDecoderIntent = Readonly<{
  childCapabilityId: GptChildCapabilityId;
  input: object;
}>;

const decodedInput = (intent: GptInputDecoderIntent): Readonly<Record<string, unknown>> => {
  if (!intent.input || typeof intent.input !== "object" || Array.isArray(intent.input)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:input`);
  }
  return intent.input as Readonly<Record<string, unknown>>;
};

export const requireBrowser = (context: GptExecutionContext) => {
  if (!context.browser) throw executionFailure("failed", "GPT_BROWSER_TARGET_REQUIRED");
  if (context.signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
  return context.browser;
};

export const requireConfirmedBrowserFact = <
  K extends GptChildCapabilityId,
  AllowsNo extends boolean = false,
>(
  intent: GptChildCapabilityIntent<K>,
  context: Pick<GptExecutionContext, "browser" | "browserAtomicIdentity">,
  options: Readonly<{ allowNoMutationOutcome: AllowsNo }> = Object.freeze({
    allowNoMutationOutcome: false as AllowsNo,
  }),
): ConfirmedGptChildBrowserFact<AllowsNo> => {
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId];
  if (contract.replayPolicy === "observation-only"
    || contract.replayPolicy === "transaction-identical-readback") {
    throw executionFailure("failed", "GPT_BROWSER_TERMINAL_FACT_NOT_APPLICABLE");
  }
  const recovery = context.browser && context.browserAtomicIdentity
    ? context.browser.readAtomicStepOutcome(context.browserAtomicIdentity) : null;
  const mutationOutcome = recovery?.mutationOutcome;
  if (!recovery || recovery.state !== "confirmed"
    || (mutationOutcome !== "confirmed"
      && (!options.allowNoMutationOutcome || mutationOutcome !== "no"))) {
    throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED", {
      mutationOutcome: recovery?.mutationOutcome ?? "no",
    });
  }
  return Object.freeze({
    exactCallIdentityHash: gptExactCallIdentityHash(intent),
    childCapabilityId: intent.childCapabilityId,
    effectScope: contract.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local",
    browserOutcome: "CONFIRMED",
    mutationOutcome,
    terminalAt: recovery.terminalAt,
    evidenceRef: recovery.authorityRef,
    evidenceHash: recovery.authorityHash,
  }) as ConfirmedGptChildBrowserFact<AllowsNo>;
};

export const requireExactInputKeys = (
  intent: GptInputDecoderIntent,
  required: readonly string[],
  optional: readonly string[] = [],
): void => {
  const input = decodedInput(intent);
  const keys = Object.keys(input).sort();
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !(key in input));
  const extra = keys.filter((key) => !allowed.has(key));
  if (missing.length || extra.length) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:missing=${missing.join(",")}:extra=${extra.join(",")}`);
  }
};

export const stringInput = (intent: GptInputDecoderIntent, key: string): string => {
  const value = decodedInput(intent)[key];
  if (typeof value !== "string" || value.length === 0) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value;
};

export const numberInput = (intent: GptInputDecoderIntent, key: string): number => {
  const value = decodedInput(intent)[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value;
};

export const recordInput = (intent: GptInputDecoderIntent, key: string): Readonly<Record<string, unknown>> => {
  const value = decodedInput(intent)[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value as Readonly<Record<string, unknown>>;
};

export const arrayInput = (intent: GptInputDecoderIntent, key: string): readonly unknown[] => {
  const value = decodedInput(intent)[key];
  if (!Array.isArray(value)) {
    throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  }
  return value;
};

export const success = <T>(
  input: Omit<GptChildObservationValue<T>, "postconditionResult">,
): GptChildObservationValue<T> =>
  Object.freeze({ ...input, postconditionResult: "passed" });

export const declaredFacts = (
  input: GptChildFactDeclaration,
): GptChildFactDeclaration => Object.freeze({
  ...input,
  factResultIds: Object.freeze([...input.factResultIds]),
  candidateCardinality: Object.freeze({ ...input.candidateCardinality }),
  authorityRefHashes: Object.freeze([...input.authorityRefHashes]),
});
