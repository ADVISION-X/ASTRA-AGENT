import type {
  GptAnyChildCapabilityIntent, GptChildBrowserFact, GptChildCapabilityId,
  GptChildCapabilityIntent, GptChildCapabilityResult, GptHash,
} from "./contract.js";
import { gptExactCallIdentityHash } from "./contract.js";
import type { BrowserExactCallMutationFact } from "../../lib/browser/browser-authority-api.js";
import type { BrowserAtomicStepIdentity } from "../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type {
  ProductionGptBrowserCall, ProductionGptBrowserLifecycle,
} from "./production-browser-lifecycle.js";
import { productionGptAtomicIdentity } from "./production-atomic-call.js";
import type { GptProductionExecutionInput as ExecutionInput } from "./production-child-support.js";

export const submitEffect = (
  prior: BrowserExactCallMutationFact,
  exactCallIdentityHash: GptHash,
  childCapabilityId: "submit_exact_gpt_turn_once",
): GptChildBrowserFact => {
  const confirmed = prior.outcome === "CONFIRMED" && prior.mutationOutcome === "confirmed" && prior.terminalAt;
  const dispatched = prior.outcome === "DISPATCHED" && prior.mutationOutcome === "dispatched" && !prior.terminalAt;
  if (prior.effectScope !== "provider_effect" || (!confirmed && !dispatched)
    || !prior.providerEffectIdentityHash) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  }
  return Object.freeze({ exactCallIdentityHash, providerEffectIdentityHash: prior.providerEffectIdentityHash,
    childCapabilityId, effectScope: "provider_effect", browserOutcome: prior.outcome,
    mutationOutcome: prior.mutationOutcome, terminalAt: prior.terminalAt,
    evidenceRef: prior.authorityRef, evidenceHash: prior.authorityHash });
};

export const recordConfirmedSubmission = async (
  call: ProductGptCallInput<GptChildCapabilityId>,
  result: GptChildCapabilityResult,
  intent: GptAnyChildCapabilityIntent,
  execution: ExecutionInput,
  browsers: ProductionGptBrowserLifecycle,
  browserCall: ProductionGptBrowserCall | undefined,
  browserAtomicIdentity?: BrowserAtomicStepIdentity,
): Promise<void> => {
  if (call.child !== "submit_exact_gpt_turn_once" || result.status !== "success") return;
  const effect = result.proof.browserFact;
  if (effect?.effectScope !== "provider_effect" || effect.browserOutcome !== "CONFIRMED"
    || !effect.providerEffectIdentityHash) {
    throw executionFailure("failed", "GPT_PROVIDER_EFFECT_IDENTITY_MISSING");
  }
  const submitted = result.value as Readonly<Record<string, unknown>>;
  if (typeof submitted.canonicalConversationUrl !== "string" || typeof submitted.userTurnId !== "string") {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  }
  if (!browserCall) throw executionFailure("failed", "GPT_BROWSER_REQUIRED");
  await browsers.recordConfirmedProviderEffect(
    browserCall, effect, browserAtomicIdentity
      ?? productionGptAtomicIdentity(intent, execution.resultRevision),
    submitted.canonicalConversationUrl, submitted.userTurnId,
  );
};

export const recordSettledProviderResult = (
  call: ProductGptCallInput<GptChildCapabilityId>,
  value: unknown,
  browsers: ProductionGptBrowserLifecycle,
  browserCall: ProductionGptBrowserCall | undefined,
): void => {
  const readsConfirmedEffect = call.child === "checkpoint_gpt_text_response"
    || call.child === "checkpoint_gpt_generated_image";
  if (!readsConfirmedEffect || !browserCall) return;
  const row = value as Readonly<Record<string, unknown>>;
  const payloadHash = call.child === "checkpoint_gpt_text_response" ? row.semanticTextHash : row.sha256;
  if (typeof payloadHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(payloadHash)) {
    throw executionFailure("failed", "GPT_SETTLED_RESULT_PAYLOAD_HASH_INVALID");
  }
  browsers.recordSettledResult(browserCall, payloadHash as GptHash);
};

export const productChildResult = <K extends GptChildCapabilityId>(input: Readonly<{
  execution: ExecutionInput;
  intent: GptChildCapabilityIntent<K>;
  value: unknown;
  browserFact: GptChildBrowserFact | null;
  evidenceRef: string;
  evidenceHash: GptHash;
  artifactRefs: readonly string[];
}>): ProductGptChildResult<K> => Object.freeze({
  value: input.value as ProductGptChildResult<K>["value"],
  evidenceRef: input.evidenceRef,
  evidenceHash: input.evidenceHash,
  sourceAttemptId: input.execution.attemptId,
  exactCallIdentityHash: gptExactCallIdentityHash(input.intent),
  artifactRefs: input.artifactRefs,
  effectReceipt: input.browserFact ? Object.freeze({
    effectScope: input.browserFact.effectScope,
    providerEffectIdentityHash: input.browserFact.providerEffectIdentityHash,
    outcome: input.browserFact.browserOutcome,
    mutationOutcome: input.browserFact.mutationOutcome,
    terminalAt: input.browserFact.terminalAt,
    evidenceRef: input.browserFact.evidenceRef,
    evidenceHash: input.browserFact.evidenceHash,
  }) : null,
});
