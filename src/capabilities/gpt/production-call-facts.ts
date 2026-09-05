import {
  type GptAnyChildCapabilityIntent,
  gptExactCallIdentityHash,
} from "./contract.js";
import { gptContinuationIdentityHash } from "./schema.js";
import { executionFailure } from "../../lib/execution-failure.js";
import type { GptProductionBrowserAuthority } from "./production-ports.js";
import type {
  ExactGptCallFacts,
} from "./product-api.js";
import type { GptContinuationStorePort } from "./session/gpt-continuation-store-port.js";
import {
  isPendingExactEvidence,
  readExactGptEvidenceFact,
} from "./evidence-fact.js";

export { isPendingExactEvidence } from "./evidence-fact.js";

export type GptExactCallFactsWithBrowserBinding = Omit<ExactGptCallFacts, "mutation"> & Readonly<{
    mutation: (NonNullable<ExactGptCallFacts["mutation"]> & Readonly<{
    mutationOutcome: "no" | "dispatched" | "confirmed";
    failureCode: string | null;
    nativeFailureCode: string | null;
    authorityRef: string;
    authorityHash: `sha256:${string}`;
    targetRef: string;
    documentRef: string;
  }>) | null;
}>;

export const productSafeExactGptCallFacts = (facts: GptExactCallFactsWithBrowserBinding): ExactGptCallFacts =>
  Object.freeze({
    ...facts,
    mutation: facts.mutation ? Object.freeze({
      owner: facts.mutation.owner,
      sourceAttemptId: facts.mutation.sourceAttemptId,
      effectScope: facts.mutation.effectScope,
      outcome: facts.mutation.outcome,
      terminalAt: facts.mutation.terminalAt,
      productStepId: facts.mutation.productStepId,
      callId: facts.mutation.callId,
      childCapabilityId: facts.mutation.childCapabilityId,
      actionOrdinal: facts.mutation.actionOrdinal,
    }) : null,
  });

type FactReader = Readonly<{
  browserAuthority: GptProductionBrowserAuthority;
  evidenceStore: Parameters<typeof readExactGptEvidenceFact>[0]["evidenceStore"];
  store: GptContinuationStorePort;
}>;

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>> : null;

const continuationRefFromIntent = (intent: GptAnyChildCapabilityIntent): string | null => {
  if (intent.childCapabilityId === "persist_gpt_continuation") {
    return `gpt-continuation:${gptExactCallIdentityHash(intent).slice(7)}`;
  }
  if ("continuationRef" in intent.input
    && typeof intent.input.continuationRef === "string" && intent.input.continuationRef.length > 0) {
    return intent.input.continuationRef;
  }
  const lane = record("lane" in intent.input ? intent.input.lane : null);
  return typeof lane?.continuation_ref === "string" && lane.continuation_ref.length > 0
    ? lane.continuation_ref : null;
};

const readContinuation = (
  reader: FactReader,
  intent: GptAnyChildCapabilityIntent,
): ExactGptCallFacts["continuation"] => {
  const continuationRef = continuationRefFromIntent(intent);
  if (!continuationRef) return null;
  const stored = reader.store.readGptContinuation(continuationRef);
  if (!stored) return null;
  if (stored.conversation_identity_hash !== gptContinuationIdentityHash(stored.provider)) {
    throw executionFailure("failed", "GPT_CONTINUATION_IDENTITY_INVALID");
  }
  return Object.freeze({
    owner: "gpt-session-controller", continuationRef,
    conversationIdentityHash: stored.conversation_identity_hash, laneVersion: stored.lane_version,
    priorPromptHash: stored.provider.prior_prompt_hash,
    priorResponseHash: stored.provider.prior_raw_output_hash, contentReadbackVerified: true,
  });
};

export const readProductionGptCallFacts = async (
  reader: FactReader,
  intent: GptAnyChildCapabilityIntent,
): Promise<GptExactCallFactsWithBrowserBinding> => {
  const exactCallIdentityHash = gptExactCallIdentityHash(intent);
  const mutation = reader.browserAuthority.readExactCallMutationFact({
    jobId: intent.jobId, attemptId: intent.attemptId, ownerPluginId: intent.pluginId,
    pluginVersion: intent.pluginVersion, exactCallIdentityHash, actionOrdinal: intent.actionOrdinal,
  });
  return Object.freeze({
    exactCallIdentityHash,
    mutation: mutation ? Object.freeze({
      owner: "browser",
      sourceAttemptId: intent.attemptId,
      effectScope: mutation.effectScope,
      outcome: mutation.outcome,
      mutationOutcome: mutation.mutationOutcome,
      failureCode: mutation.failureCode,
      nativeFailureCode: mutation.nativeFailureCode,
      terminalAt: mutation.terminalAt,
      authorityRef: mutation.authorityRef,
      authorityHash: mutation.authorityHash,
      targetRef: mutation.targetRef,
      documentRef: mutation.documentRef,
      productStepId: mutation.productStepId,
      callId: mutation.callId,
      childCapabilityId: mutation.childCapabilityId,
      actionOrdinal: mutation.actionOrdinal,
    }) : null,
    evidence: await readExactGptEvidenceFact({
      evidenceStore: reader.evidenceStore, intent, exactCallIdentityHash,
    }),
    continuation: readContinuation(reader, intent),
  });
};
