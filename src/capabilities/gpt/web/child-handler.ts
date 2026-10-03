import { GPT_CHILD_CAPABILITY_CONTRACTS, gptExactCallIdentityHash, type GptChildBrowserFact,
  type GptChildCapabilityId, type GptChildCapabilityIntent, type GptChildOutputMap, type GptExecutionContext } from "../contract.js";
import type { BrowserAtomicStepOutcome } from "../../../lib/browser/browser-authority-api.js";
import { gptExecutionFailure } from "../execution-fault.js";
import { executionFailure } from "../../../lib/execution-failure.js";

type GptChildObservationValue<T> = Readonly<{ value: T; decision: "DONE" | "ACT"; factResultIds: readonly string[];
  candidateCardinality: Readonly<{ raw: number | null; eligible: number | null }>;
  authorityRefHashes: readonly `sha256:${string}`[]; observationRevisionHash: `sha256:${string}` | null;
  mutationOutcome: "no" | "dispatched" | "confirmed"; postconditionResult: "passed";
  browserFact: GptChildBrowserFact | null; nativeFailureCode: string | null }>;
type GptChildFactDeclaration = Omit<GptChildObservationValue<never>, "value" | "postconditionResult">;
export type GptChildObservation<K extends GptChildCapabilityId = GptChildCapabilityId> = GptChildObservationValue<GptChildOutputMap[K]>;
export type GptChildHandler<K extends GptChildCapabilityId> = (intent: GptChildCapabilityIntent<K>, context: GptExecutionContext) => Promise<GptChildObservation<K>>;
type GptInputDecoderIntent = Readonly<{ childCapabilityId: GptChildCapabilityId; input: object }>;
const HASH = /^sha256:[a-f0-9]{64}$/u;
const decodedInput = (intent: GptInputDecoderIntent): Readonly<Record<string, unknown>> => {
  if (!intent.input || typeof intent.input !== "object" || Array.isArray(intent.input)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:input`);
  return intent.input as Readonly<Record<string, unknown>>;
};
export const requireBrowser = (context: GptExecutionContext) => {
  if (!context.browser) throw executionFailure("failed", "GPT_BROWSER_TARGET_REQUIRED");
  if (context.signal?.aborted) throw executionFailure("failed", "GPT_EXECUTION_ABORTED");
  return context.browser;
};
const terminalOutcomeValid = (outcome: BrowserAtomicStepOutcome): boolean => {
  if (outcome.state === "dispatched") return outcome.terminalAt === null && outcome.mutationOutcome === "dispatched" && outcome.terminalPayload == null;
  if (!["confirmed", "rejected"].includes(outcome.state) || typeof outcome.terminalAt !== "string") return false;
  const time = Date.parse(outcome.terminalAt);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== outcome.terminalAt) return false;
  if (outcome.mutationOutcome === "no") return outcome.physicalInputCount === 0;
  if (outcome.state === "confirmed") return outcome.mutationOutcome === "confirmed" && outcome.physicalInputCount > 0;
  return outcome.mutationOutcome === "dispatched" || outcome.mutationOutcome === "confirmed" && outcome.physicalInputCount > 0;
};
const atomicOutcomeValid = (outcome: BrowserAtomicStepOutcome, replayPolicy: string): boolean => {
  const provider = replayPolicy === "provider-effect-once";
  const effectValid = provider ? typeof outcome.providerEffectIdentityHash === "string" && HASH.test(outcome.providerEffectIdentityHash)
    : outcome.providerEffectIdentityHash === null;
  return Number.isInteger(outcome.physicalInputCount) && outcome.physicalInputCount >= 0 && outcome.physicalInputCount <= 4
    && typeof outcome.authorityRef === "string" && outcome.authorityRef.length > 0 && HASH.test(outcome.authorityHash)
    && effectValid && terminalOutcomeValid(outcome);
};
/** The public read binds the seven origin fields to the lease; GPT and Browser hashes retain their own namespaces. */
export const projectBrowserFact = <K extends GptChildCapabilityId>(intent: GptChildCapabilityIntent<K>,
  context: Pick<GptExecutionContext, "browser" | "browserAtomicIdentity">,
): Readonly<{ fact: GptChildBrowserFact; outcome: BrowserAtomicStepOutcome }> | null => {
  const contract = GPT_CHILD_CAPABILITY_CONTRACTS[intent.childCapabilityId];
  if (["observation-only", "transaction-identical-readback"].includes(contract.replayPolicy)) return null;
  const identity = context.browserAtomicIdentity;
  if (!context.browser || !identity) return null;
  // Provider inputHash is the original revision-bound hash admitted by atomic-call, including historical readback.
  const expected = { resultRevision: intent.resultRevision, productStepId: intent.productStepId, callId: intent.callId,
    childCapabilityId: intent.childCapabilityId, inputHash: contract.replayPolicy === "provider-effect-once" ? identity.inputHash : intent.inputHash,
    actionOrdinal: intent.actionOrdinal, replayPolicy: contract.replayPolicy };
  if (!HASH.test(identity.inputHash) || Object.entries(expected).some(([key, value]) => identity[key as keyof typeof identity] !== value)) {
    throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED");
  }
  const outcome = context.browser.readAtomicStepOutcome(identity);
  if (!outcome) return null;
  if (!atomicOutcomeValid(outcome, contract.replayPolicy)) throw gptExecutionFailure("GPT_BROWSER_TERMINAL_FACT_REQUIRED", { mutationOutcome: outcome.mutationOutcome });
  const fact: GptChildBrowserFact = Object.freeze({ exactCallIdentityHash: gptExactCallIdentityHash(intent),
    providerEffectIdentityHash: outcome.providerEffectIdentityHash, childCapabilityId: intent.childCapabilityId,
    effectScope: contract.replayPolicy === "provider-effect-once" ? "provider_effect" : "target_local",
    browserOutcome: outcome.state === "confirmed" ? "CONFIRMED" : outcome.state === "dispatched" ? "DISPATCHED" : "REJECTED",
    mutationOutcome: outcome.mutationOutcome, terminalAt: outcome.terminalAt, evidenceRef: outcome.authorityRef, evidenceHash: outcome.authorityHash });
  return Object.freeze({ fact, outcome });
};
export const requireExactInputKeys = (intent: GptInputDecoderIntent, required: readonly string[], optional: readonly string[] = []): void => {
  const input = decodedInput(intent), allowed = new Set([...required, ...optional]);
  const missing = required.filter(key => !(key in input)), extra = Object.keys(input).sort().filter(key => !allowed.has(key));
  if (missing.length || extra.length) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:missing=${missing.join(",")}:extra=${extra.join(",")}`);
};
export const stringInput = (intent: GptInputDecoderIntent, key: string): string => {
  const value = decodedInput(intent)[key];
  if (typeof value !== "string" || value.length === 0) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value;
};
export const numberInput = (intent: GptInputDecoderIntent, key: string): number => {
  const value = decodedInput(intent)[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value;
};
export const recordInput = (intent: GptInputDecoderIntent, key: string): Readonly<Record<string, unknown>> => {
  const value = decodedInput(intent)[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value as Readonly<Record<string, unknown>>;
};
export const arrayInput = (intent: GptInputDecoderIntent, key: string): readonly unknown[] => {
  const value = decodedInput(intent)[key];
  if (!Array.isArray(value)) throw executionFailure("failed", `GPT_CHILD_INPUT_INVALID:${intent.childCapabilityId}:${key}`);
  return value;
};
export const success = <T>(input: Omit<GptChildObservationValue<T>, "postconditionResult">): GptChildObservationValue<T> => Object.freeze({ ...input, postconditionResult: "passed" });
export const declaredFacts = (input: GptChildFactDeclaration): GptChildFactDeclaration => Object.freeze({ ...input,
  factResultIds: Object.freeze([...input.factResultIds]), candidateCardinality: Object.freeze({ ...input.candidateCardinality }),
  authorityRefHashes: Object.freeze([...input.authorityRefHashes]) });
