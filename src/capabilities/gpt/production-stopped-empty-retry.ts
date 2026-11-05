import { GPT_RETRY_CHILD, GPT_RETRY_LIMIT, gptRetryCallId, assertGptRetryTerminalPayload, type BrowserProviderEffectStepCallFact,
  type GptStoppedEmptyRetryInput } from "../../lib/browser/browser-authority-api.js";
import { executionFailure, executionFailureMetadata, failureCode, type ProviderStoppedEmptyProof } from "../../lib/execution-failure.js";
import { failedGptChildExecutionResult } from "./ability-group.js";
import { gptCanonicalHash, type GptAnyChildCapabilityIntent, type GptChildBrowserFact,
  type GptChildCapabilityResult, type GptHash } from "./contract.js";
import { gptExecutionFailure } from "./execution-fault.js";
import { throwGptChildFailure } from "./production-child-support.js";
import type { ProductGptCallInput, ProductGptChildResult } from "./product-api.js";
import type { ProductionGptBrowserCall } from "./production-browser-lifecycle.js";
import type { GptExecutionProfile } from "./schema.js";
import type { GptProductionBrowserAuthority } from "./production-ports.js";

export type GptRetryRoot = Readonly<{ jobId: string; productStepId: string; effectIdentityHash: GptHash;
  sourceAttemptId: string; sourceResultRevision: number; promptHash: GptHash;
  userTurnId: string; canonicalConversationUrl: string }>;

/** Read the actual finite chain, retaining every physical input and its immutable authority. */
export const readConfirmedRetryCompanions = (authority: GptProductionBrowserAuthority, root: GptRetryRoot) => {
  const history = authority.readJobBrowserHistoryEvidence(root.jobId);
  const prefix = `stopped-empty-retry:${root.effectIdentityHash.slice(7)}:`;
  const members = history.replayEffects.filter(effect => effect.childCapabilityId === GPT_RETRY_CHILD && effect.callId.startsWith(prefix));
  if (!history.walHistoryVerified || members.length > GPT_RETRY_LIMIT) {
    throw executionFailure("failed", "GPT_RETRY_BROWSER_RECEIPT_INVALID");
  }
  let previous = root.effectIdentityHash, profileHash: GptHash | null = null;
  return Array.from({ length: members.length }, (_, index) => {
    const ordinal = index + 1, selected = members.filter(effect => effect.callId === gptRetryCallId(root.effectIdentityHash, ordinal));
    if (selected.length !== 1) throw executionFailure("failed", "GPT_RETRY_BROWSER_RECEIPT_INVALID");
    const effect = selected[0]!;
    if (effect.productStepId !== root.productStepId || effect.attemptId !== root.sourceAttemptId
      || effect.resultRevision !== root.sourceResultRevision || effect.state !== "CONFIRMED"
      || effect.mutationOutcome !== "confirmed" || effect.physicalInputCount !== 1) {
      throw executionFailure("failed", "PROVIDER_EFFECT_OUTCOME_UNPROVEN");
    }
    const original = authority.readSourceConfirmedProviderEffect({ jobId: root.jobId,
      sourceAttemptId: effect.attemptId, sourceResultRevision: effect.resultRevision,
      productStepId: effect.productStepId, callId: effect.callId, childCapabilityId: effect.childCapabilityId,
      effectIdentityHash: effect.effectIdentityHash, walAuthorityHash: effect.walAuthorityHash });
    const proof = original.terminalPayload;
    assertGptRetryTerminalPayload(proof, { exactCallIdentityHash: original.exactCallIdentityHash,
      childCapabilityId: effect.childCapabilityId, callId: effect.callId });
    if (proof.originalEffectIdentityHash !== root.effectIdentityHash || proof.previousEffectIdentityHash !== previous
      || proof.promptHash !== root.promptHash || proof.userTurnId !== root.userTurnId
      || original.conversationLocator?.canonicalConversationUrl !== root.canonicalConversationUrl
      || (profileHash !== null && proof.profileHash !== profileHash)) {
      throw executionFailure("failed", "GPT_RETRY_BROWSER_RECEIPT_INVALID");
    }
    previous = effect.effectIdentityHash; profileHash = proof.profileHash;
    return Object.freeze({ effect, original, proof });
  });
};

type RetryCall = ProductGptCallInput<typeof GPT_RETRY_CHILD> & Readonly<{ sessionKey: string }>;
type MenuCall = ProductGptCallInput<"open_exact_gpt_retry_menu"> & Readonly<{ sessionKey: string }>;
type CheckpointCall = ProductGptCallInput<"checkpoint_gpt_text_response"> & Readonly<{ sessionKey: string }>;
type Root = NonNullable<ProductionGptBrowserCall["confirmedProviderEffect"]>;
type RetryEvidence = ProviderStoppedEmptyProof["retries"][number];
type RepairInput = Readonly<{
  dataDir: string; signal: AbortSignal; call: CheckpointCall; intent: GptAnyChildCapabilityIntent;
  root: Root; profile: GptExecutionProfile; promptHash: GptHash; initial: GptChildCapabilityResult;
  readRetry(callId: string): BrowserProviderEffectStepCallFact | null;
  executeMenu(call: MenuCall): Promise<ProductGptChildResult<"open_exact_gpt_retry_menu">>;
  executeRetry(call: RetryCall, prior: BrowserProviderEffectStepCallFact | null): Promise<ProductGptChildResult<typeof GPT_RETRY_CHILD>>;
  observe(readbackOnly: boolean): Promise<GptChildCapabilityResult>;
  assertBudget(priorKnown: boolean): void;
}>;

const retryInput = (input: RepairInput, previous: GptHash, ordinal: number): GptStoppedEmptyRetryInput => ({
  originalEffectIdentityHash: input.root.providerEffectIdentityHash!, previousEffectIdentityHash: previous,
  retryOrdinal: ordinal, promptHash: input.promptHash,
  originalUserTurnId: input.root.userTurnId, profileHash: input.profile.profileHash,
  approvedModel: input.profile.startModelDisplayName, turnMarker: input.call.input.turnMarker,
  turnMarkerHash: gptCanonicalHash(input.call.input.turnMarker),
});

const retryEffect = (result: ProductGptChildResult<typeof GPT_RETRY_CHILD>): GptChildBrowserFact => {
  const receipt = result.effectReceipt;
  if (!receipt || receipt.outcome !== "CONFIRMED" || receipt.mutationOutcome !== "confirmed"
    || !receipt.providerEffectIdentityHash) throw executionFailure("failed", "GPT_RETRY_BROWSER_RECEIPT_INVALID");
  return Object.freeze({ exactCallIdentityHash: result.exactCallIdentityHash, childCapabilityId: GPT_RETRY_CHILD,
    effectScope: "provider_effect", browserOutcome: receipt.outcome, mutationOutcome: receipt.mutationOutcome,
    providerEffectIdentityHash: receipt.providerEffectIdentityHash, terminalAt: receipt.terminalAt,
    evidenceRef: receipt.evidenceRef, evidenceHash: receipt.evidenceHash });
};

const observedResult = (result: GptChildCapabilityResult, effect: GptChildBrowserFact | null): GptChildCapabilityResult => {
  if (effect && result.status === "failed" && result.failureCode !== "GPT_TEXT_RESPONSE_EMPTY_ENDED") {
    throwGptChildFailure(result, result.proof.evidenceRef, undefined, effect);
  }
  return result;
};

const exhaustedResponse = (input: RepairInput, result: GptChildCapabilityResult,
  retries: readonly RetryEvidence[], effect: GptChildBrowserFact): Promise<GptChildCapabilityResult> => {
  const observedAt = result.proof.emptyEndedAt, revision = result.proof.observationRevisionHash;
  if (retries.length !== GPT_RETRY_LIMIT || !observedAt || !revision || !input.root.providerEffectIdentityHash) {
    throw executionFailure("failed", "GPT_STOPPED_EMPTY_EVIDENCE_INVALID");
  }
  const stoppedEmptyProof: ProviderStoppedEmptyProof = Object.freeze({ schemaVersion: "gpt-stopped-empty-after-five-retries.v1",
    originalEffectIdentityHash: input.root.providerEffectIdentityHash,
    originalWalAuthorityRef: input.root.evidenceRef, originalWalAuthorityHash: input.root.evidenceHash,
    retries: Object.freeze([...retries]), terminalObservationRevisionHash: revision, terminalObservedAt: observedAt });
  const error = gptExecutionFailure("GPT_RESPONSE_STOPPED_EMPTY", { mutationOutcome: "confirmed", browserEffect: effect,
    evidence: { evidenceRef: effect.evidenceRef, evidenceHash: effect.evidenceHash }, proofFacts: {
      decision: "FAIL_CLOSED", factResultIds: result.proof.factResultIds,
      candidateCardinality: result.proof.candidateCardinality, authorityRefHashes: result.proof.authorityRefHashes,
      observationRevisionHash: revision, mutationOutcome: "confirmed", browserFact: effect,
      nativeFailureCode: "GPT_RESPONSE_STOPPED_EMPTY", stoppedEmptyProof,
    } });
  return failedGptChildExecutionResult({ intent: input.intent, context: { dataDir: input.dataDir, signal: input.signal },
    startedAt: input.initial.proof.startedAt, error });
};

/** A finite mechanical closure inside the original checkpoint; no task/revision/recovery authority. */
export const repairStoppedEmptyResponse = async (input: RepairInput): Promise<GptChildCapabilityResult> => {
  let result = input.initial, previous = input.root.providerEffectIdentityHash!;
  let latest: GptChildBrowserFact | null = null;
  const retries: RetryEvidence[] = [];
  try {
    for (let ordinal = 1; ordinal <= GPT_RETRY_LIMIT; ordinal += 1) {
      if (result.status === "success" || result.failureCode !== "GPT_TEXT_RESPONSE_EMPTY_ENDED") return observedResult(result, latest);
      const callId = gptRetryCallId(input.root.providerEffectIdentityHash!, ordinal);
      const childInput = retryInput(input, previous, ordinal), prior = input.readRetry(callId);
      const zero = prior?.mutation.outcome === "REJECTED" && prior.mutation.mutationOutcome === "no"
        && prior.mutation.physicalInputCount === 0;
      input.assertBudget(prior !== null && !zero);
      const common = { sessionKey: input.call.sessionKey, productStepId: input.call.productStepId,
        callId, actionOrdinal: 1, input: childInput };
      if (!prior) {
        const menu = await input.executeMenu({ ...common, child: "open_exact_gpt_retry_menu" });
        if (menu.value.state === "response-changed") return observedResult(await input.observe(true), latest);
      }
      let retried: ProductGptChildResult<typeof GPT_RETRY_CHILD>;
      try { retried = await input.executeRetry({ ...common, child: GPT_RETRY_CHILD }, prior); }
      catch (error) {
        if (failureCode(error) === "BROWSER_POSTCONDITION_FAILED"
          && executionFailureMetadata(error)?.mutationOutcome === "no") return observedResult(await input.observe(true), latest);
        throw error;
      }
      latest = retryEffect(retried);
      previous = latest.providerEffectIdentityHash!;
      retries.push(Object.freeze({ ordinal, effectIdentityHash: previous, walAuthorityRef: latest.evidenceRef,
        walAuthorityHash: latest.evidenceHash, preEmptyObservationRevisionHash: retried.value.preEmptyObservationRevisionHash }));
      result = await input.observe(false);
    }
    if (result.status === "failed" && result.failureCode === "GPT_TEXT_RESPONSE_EMPTY_ENDED" && latest) {
      return exhaustedResponse(input, result, retries, latest);
    }
    return observedResult(result, latest);
  } catch (error) {
    if (!latest || executionFailureMetadata(error)?.browserEffect?.childCapabilityId === GPT_RETRY_CHILD) throw error;
    throw gptExecutionFailure(failureCode(error), { mutationOutcome: latest.mutationOutcome, browserEffect: latest,
      evidence: { evidenceRef: latest.evidenceRef, evidenceHash: latest.evidenceHash }, cause: error });
  }
};
