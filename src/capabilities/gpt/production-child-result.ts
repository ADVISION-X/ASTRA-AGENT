import {
  gptExactCallIdentityHash, type GptAnyChildCapabilityIntent, type GptChildBrowserFact,
  type GptChildCapabilityId, type GptChildCapabilityIntent, type GptChildCapabilityResult, type GptHash,
} from "./contract.js";
import {
  browserExactCallIdentityHash, type BrowserAtomicStepIdentity,
  type BrowserExactCallMutationFact, type BrowserProviderEffectStepCallFact,
} from "../../lib/browser/browser-authority-api.js";
import { executionFailure } from "../../lib/execution-failure.js";
import { persistGptEvidenceArtifacts } from "./evidence-artifacts.js";
import { productionGptAtomicIdentity } from "./production-atomic-call.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { ProductionGptBrowserCall, ProductionGptBrowserLifecycle } from "./production-browser-lifecycle.js";
import type { GptEvidenceStorePort, GptProductionExecutionInput as ExecutionInput } from "./production-ports.js";

export const confirmedSubmitIdentity = (
  execution: ExecutionInput, call: ProductGptCallInput<"submit_exact_gpt_turn_once">,
  existing: BrowserProviderEffectStepCallFact,
): Readonly<{ atomicIdentity: BrowserAtomicStepIdentity; exactCallIdentityHash: GptHash }> => {
  const fact = existing.mutation;
  if (fact.productStepId !== call.productStepId || fact.callId !== call.callId
    || fact.childCapabilityId !== call.child || !Number.isSafeInteger(fact.actionOrdinal)
    || fact.actionOrdinal < 1 || fact.effectScope !== "provider_effect"
    || fact.outcome !== "CONFIRMED" || fact.mutationOutcome !== "confirmed"
    || fact.physicalInputCount !== 1) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  }
  const atomicIdentity: BrowserAtomicStepIdentity = Object.freeze({
    resultRevision: execution.resultRevision, productStepId: fact.productStepId,
    callId: fact.callId, childCapabilityId: fact.childCapabilityId,
    actionOrdinal: fact.actionOrdinal, inputHash: existing.inputHash,
    replayPolicy: "provider-effect-once",
  });
  const exactCallIdentityHash = browserExactCallIdentityHash({
    jobId: execution.jobId, attemptId: execution.attemptId,
    writerFenceHash: execution.executionFenceHash, ...atomicIdentity,
  });
  if (exactCallIdentityHash !== existing.exactCallIdentityHash) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  }
  return Object.freeze({ atomicIdentity, exactCallIdentityHash });
};

export const submitEffect = (
  fact: BrowserExactCallMutationFact, exactCallIdentityHash: GptHash,
  childCapabilityId: "submit_exact_gpt_turn_once",
): GptChildBrowserFact => {
  if (fact.effectScope !== "provider_effect"
    || !fact.providerEffectIdentityHash || !/^sha256:[a-f0-9]{64}$/u.test(fact.providerEffectIdentityHash)) {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_IDENTITY_MISMATCH");
  }
  return Object.freeze({
    exactCallIdentityHash, childCapabilityId, effectScope: "provider_effect",
    providerEffectIdentityHash: fact.providerEffectIdentityHash,
    browserOutcome: fact.outcome, mutationOutcome: fact.mutationOutcome,
    terminalAt: fact.terminalAt, evidenceRef: fact.authorityRef, evidenceHash: fact.authorityHash,
  });
};

const recordConfirmedSubmission = async (
  call: ProductGptCallInput<GptChildCapabilityId>, result: GptChildCapabilityResult,
  intent: GptAnyChildCapabilityIntent, execution: ExecutionInput,
  browsers: ProductionGptBrowserLifecycle, browserCall: ProductionGptBrowserCall | undefined,
  browserAtomicIdentity?: BrowserAtomicStepIdentity,
): Promise<void> => {
  if (call.child !== "submit_exact_gpt_turn_once" || result.status !== "success") return;
  const effect = result.proof.browserFact;
  if (effect?.effectScope !== "provider_effect" || effect.browserOutcome !== "CONFIRMED"
    || !effect.providerEffectIdentityHash) throw executionFailure("failed", "GPT_PROVIDER_EFFECT_IDENTITY_MISSING");
  const payload = result.value as Readonly<Record<string, unknown>>;
  if (typeof payload.userTurnId !== "string") {
    throw executionFailure("failed", "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  }
  if (browserCall) await browsers.recordConfirmedProviderEffect(
    browserCall, effect, browserAtomicIdentity ?? productionGptAtomicIdentity(intent, execution.resultRevision),
    null, payload.userTurnId,
  );
};

export const persistGptChildOutcome = async (input: Readonly<{
  call: ProductGptCallInput<GptChildCapabilityId>; result: GptChildCapabilityResult;
  intent: GptAnyChildCapabilityIntent; execution: ExecutionInput;
  browsers: ProductionGptBrowserLifecycle; browserCall: ProductionGptBrowserCall | undefined;
  browserAtomicIdentity?: BrowserAtomicStepIdentity; evidenceStore: GptEvidenceStorePort;
  confirmedSubmission?: ProductionGptBrowserCall["confirmedProviderEffect"];
}>): Promise<Readonly<{ evidenceRef: string; evidenceHash: GptHash; artifactRefs: readonly string[] }>> => {
  const { result, execution } = input;
  if (result.status !== "success" && result.failureCode === "BROWSER_KNOWN_GPT_RATE_LIMIT") {
    return Object.freeze({ evidenceRef: result.proof.browserFact?.evidenceRef ?? result.proof.evidenceRef,
      evidenceHash: result.proof.evidenceHash, artifactRefs: Object.freeze([]) });
  }
  await recordConfirmedSubmission(input.call, result, input.intent, execution,
    input.browsers, input.browserCall, input.browserAtomicIdentity);
  const artifactRefs = await persistGptEvidenceArtifacts({
    result, intent: input.intent, evidenceStore: input.evidenceStore,
    jobId: execution.jobId,
    attemptId: input.confirmedSubmission?.sourceReadback?.sourceAttemptId ?? execution.attemptId,
    exactCallIdentityHash: gptExactCallIdentityHash(input.intent),
  });
  return Object.freeze({ artifactRefs, evidenceHash: result.proof.evidenceHash,
    evidenceRef: artifactRefs[0] ?? result.proof.browserFact?.evidenceRef ?? result.proof.evidenceRef });
};

export const recordSettledProviderResult = (
  call: ProductGptCallInput<GptChildCapabilityId>, value: unknown,
  browsers: ProductionGptBrowserLifecycle, browserCall: ProductionGptBrowserCall | undefined,
): void => {
  if (!browserCall || !["checkpoint_gpt_text_response", "checkpoint_gpt_generated_image"].includes(call.child)) return;
  const row = value as Readonly<Record<string, unknown>>;
  const hash = call.child === "checkpoint_gpt_text_response" ? row.semanticTextHash : row.originalSha256;
  if (typeof hash !== "string" || !/^sha256:[a-f0-9]{64}$/u.test(hash)) {
    throw executionFailure("failed", "GPT_SETTLED_RESULT_PAYLOAD_HASH_INVALID");
  }
  browsers.recordSettledResult(browserCall, hash as GptHash);
};

export const productChildResult = <K extends GptChildCapabilityId>(input: Readonly<{
  execution: ExecutionInput; intent: GptChildCapabilityIntent<K>; value: unknown;
  browserFact: GptChildBrowserFact | null; evidenceRef: string; evidenceHash: GptHash;
  artifactRefs: readonly string[];
}>): ProductGptChildResult<K> => {
  const fact = input.browserFact;
  return Object.freeze({
    value: input.value as ProductGptChildResult<K>["value"],
    evidenceRef: input.evidenceRef, evidenceHash: input.evidenceHash,
    sourceAttemptId: input.execution.attemptId, exactCallIdentityHash: gptExactCallIdentityHash(input.intent),
    artifactRefs: input.artifactRefs,
    effectReceipt: fact ? Object.freeze({
      effectScope: fact.effectScope, providerEffectIdentityHash: fact.providerEffectIdentityHash,
      outcome: fact.browserOutcome, mutationOutcome: fact.mutationOutcome,
      terminalAt: fact.terminalAt, evidenceRef: fact.evidenceRef, evidenceHash: fact.evidenceHash,
    }) : null,
  });
};
