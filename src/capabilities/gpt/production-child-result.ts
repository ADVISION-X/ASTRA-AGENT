import { gptExactCallIdentityHash, type GptAnyChildCapabilityIntent, type GptChildBrowserFact, type GptChildCapabilityId,
  type GptChildCapabilityIntent, type GptChildCapabilityResult, type GptHash } from "./contract.js";
import { browserExactCallIdentityHash, type BrowserAtomicStepIdentity, type BrowserExactCallMutationFact,
  type BrowserProviderEffectStepCallFact } from "../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { ProductionGptBrowserCall, ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import { productionGptAtomicIdentity } from "./production-atomic-call.js";
import type { GptProductionExecutionInput as ExecutionInput, GptEvidenceStorePort } from "./production-ports.js";
import { persistGptEvidenceArtifacts } from "./evidence-artifacts.js";

export const submitEffect = (prior: BrowserExactCallMutationFact, exactCallIdentityHash: GptHash,
  childCapabilityId: "submit_exact_gpt_turn_once"): GptChildBrowserFact => {
  if (prior.effectScope !== "provider_effect" || !prior.providerEffectIdentityHash
    || !/^sha256:[a-f0-9]{64}$/u.test(prior.providerEffectIdentityHash)) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  }
  return Object.freeze({ exactCallIdentityHash, providerEffectIdentityHash: prior.providerEffectIdentityHash,
    childCapabilityId, effectScope: "provider_effect", browserOutcome: prior.outcome, mutationOutcome: prior.mutationOutcome,
    terminalAt: prior.terminalAt, evidenceRef: prior.authorityRef, evidenceHash: prior.authorityHash });
};
export const confirmedSubmitIdentity = (execution: ExecutionInput, call: ProductGptCallInput<"submit_exact_gpt_turn_once">,
  existing: BrowserProviderEffectStepCallFact): Readonly<{ atomicIdentity: BrowserAtomicStepIdentity; exactCallIdentityHash: GptHash }> => {
  const prior = existing.mutation;
  if (Object.entries({ productStepId: call.productStepId, callId: call.callId, childCapabilityId: call.child, actionOrdinal: call.actionOrdinal })
    .some(([key, value]) => prior[key as keyof typeof prior] !== value)) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  const atomicIdentity: BrowserAtomicStepIdentity = Object.freeze({ resultRevision: execution.resultRevision, productStepId: prior.productStepId,
    callId: prior.callId, childCapabilityId: prior.childCapabilityId, inputHash: existing.inputHash,
    actionOrdinal: prior.actionOrdinal, replayPolicy: "provider-effect-once" });
  const exactCallIdentityHash = browserExactCallIdentityHash({ jobId: execution.jobId, attemptId: execution.attemptId,
    writerFenceHash: execution.executionFenceHash, ...atomicIdentity });
  if (exactCallIdentityHash !== existing.exactCallIdentityHash) throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  return Object.freeze({ atomicIdentity, exactCallIdentityHash });
};
export const recordConfirmedSubmission = async (call: ProductGptCallInput<GptChildCapabilityId>, result: GptChildCapabilityResult,
  intent: GptAnyChildCapabilityIntent, execution: ExecutionInput, browsers: ProductionGptBrowserLifecycle,
  browserCall: ProductionGptBrowserCall | undefined, browserAtomicIdentity?: BrowserAtomicStepIdentity): Promise<void> => {
  if (call.child !== "submit_exact_gpt_turn_once" || result.status !== "success") return;
  const effect = result.proof.browserFact;
  if (effect?.effectScope !== "provider_effect" || effect.browserOutcome !== "CONFIRMED" || !effect.providerEffectIdentityHash) {
    throw executionFailure("failed", "GPT_PROVIDER_EFFECT_IDENTITY_MISSING");
  }
  const value = result.value as Readonly<Record<string, unknown>>;
  if (typeof value.canonicalConversationUrl !== "string" || typeof value.userTurnId !== "string") throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  if (!browserCall) throw executionFailure("failed", "GPT_BROWSER_REQUIRED");
  await browsers.recordConfirmedProviderEffect(browserCall, effect, browserAtomicIdentity ?? productionGptAtomicIdentity(intent, execution.resultRevision),
    value.canonicalConversationUrl, value.userTurnId);
};
export const persistGptChildOutcome = async (input: Readonly<{ call: ProductGptCallInput<GptChildCapabilityId>; result: GptChildCapabilityResult;
  intent: GptAnyChildCapabilityIntent; execution: ExecutionInput; browsers: ProductionGptBrowserLifecycle;
  browserCall: ProductionGptBrowserCall | undefined; browserAtomicIdentity?: BrowserAtomicStepIdentity; evidenceStore: GptEvidenceStorePort;
}>): Promise<Readonly<{ evidenceRef: string; evidenceHash: GptHash; artifactRefs: readonly string[] }>> => {
  const { call, result, intent, execution, browsers, browserCall, browserAtomicIdentity } = input;
  if (result.status !== "success" && result.failureCode === "BROWSER_KNOWN_GPT_RATE_LIMIT") return Object.freeze({
    evidenceRef: result.proof.browserFact?.evidenceRef ?? result.proof.evidenceRef, evidenceHash: result.proof.evidenceHash, artifactRefs: Object.freeze([]) });
  await recordConfirmedSubmission(call, result, intent, execution, browsers, browserCall, browserAtomicIdentity);
  const artifactRefs = await persistGptEvidenceArtifacts({ result, intent, evidenceStore: input.evidenceStore,
    jobId: execution.jobId, attemptId: execution.attemptId, exactCallIdentityHash: gptExactCallIdentityHash(intent) });
  return Object.freeze({ evidenceRef: artifactRefs[0] ?? result.proof.browserFact?.evidenceRef ?? result.proof.evidenceRef,
    evidenceHash: result.proof.evidenceHash, artifactRefs });
};
export const recordSettledProviderResult = (call: ProductGptCallInput<GptChildCapabilityId>, value: unknown,
  browsers: ProductionGptBrowserLifecycle, browserCall: ProductionGptBrowserCall | undefined): void => {
  if (!["checkpoint_gpt_text_response", "checkpoint_gpt_generated_image"].includes(call.child) || !browserCall) return;
  const row = value as Readonly<Record<string, unknown>>, payloadHash = call.child === "checkpoint_gpt_text_response" ? row.semanticTextHash : row.originalSha256;
  if (typeof payloadHash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(payloadHash)) throw executionFailure("failed", "GPT_SETTLED_RESULT_PAYLOAD_HASH_INVALID");
  browsers.recordSettledResult(browserCall, payloadHash as GptHash);
};
export const productChildResult = <K extends GptChildCapabilityId>(input: Readonly<{ execution: ExecutionInput; intent: GptChildCapabilityIntent<K>;
  value: unknown; browserFact: GptChildBrowserFact | null; evidenceRef: string; evidenceHash: GptHash; artifactRefs: readonly string[];
}>): ProductGptChildResult<K> => Object.freeze({ value: input.value as ProductGptChildResult<K>["value"], evidenceRef: input.evidenceRef,
  evidenceHash: input.evidenceHash, sourceAttemptId: input.execution.attemptId, exactCallIdentityHash: gptExactCallIdentityHash(input.intent),
  artifactRefs: input.artifactRefs, effectReceipt: input.browserFact ? Object.freeze({ effectScope: input.browserFact.effectScope,
    providerEffectIdentityHash: input.browserFact.providerEffectIdentityHash, outcome: input.browserFact.browserOutcome,
    mutationOutcome: input.browserFact.mutationOutcome, terminalAt: input.browserFact.terminalAt,
    evidenceRef: input.browserFact.evidenceRef, evidenceHash: input.browserFact.evidenceHash }) : null });
