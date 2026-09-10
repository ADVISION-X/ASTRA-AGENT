import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";

import {
  type ExactGptContinuationReadback,
  type ExactGptCallFacts,
  type GptContinuationCheckpointInput,
  type ProductGptTools,
  type GptProviderContinuation,
} from "../../../src/capabilities/gpt/index.js";
import {
  hashCanonical,
  type SharedExecutionContext,
} from "../../../src/mediator/product-plugin-contract.js";
import { productionRoutePolicy } from "../../../src/lib/local-runtime/production/route-policy.js";
import { executionFailure } from "../../../src/lib/execution-failure.js";
import { articleOutput, researchOutput } from
  "./public-knowledge-article-pipeline-output-fixtures.js";
import {
  CONFIRMED_AT,
  HASH,
  type SeoCall,
  type SeoFailure,
  type SeoHarness,
} from "./public-knowledge-article-pipeline-fixture-state.js";

type SeoExecuteInput = Parameters<ProductGptTools["execute"]>[0];
type GptTextCheckpointInput = Extract<GptContinuationCheckpointInput, { checkpointKind: "text" }>;
type FrontierReadback = Extract<ExactGptContinuationReadback, { lookupKind: "frontier_ref" }>;
type ExactGptTextCheckpointReadback = FrontierReadback["originCheckpoint"];
type ExactGptGeneratedImageCheckpointReadback = Extract<
  FrontierReadback["currentCheckpoint"], { checkpointKind: "generated_image" }
>;
type SeoFactQuery = Parameters<SharedExecutionContext["gpt"]["readCallFacts"]>[0];
const callIdentityHash = (input: Pick<SeoFactQuery, "productStepId" | "callId" | "child" | "actionOrdinal" | "input">): string =>
  hashCanonical({
    productStepId: input.productStepId, callId: input.callId, child: input.child,
    actionOrdinal: input.actionOrdinal, input: input.input,
  });
const factKey = (attemptId: string, input: SeoFactQuery): string =>
  hashCanonical({ attemptId, callIdentityHash: callIdentityHash(input) });

const textCheckpointReadback = (
  checkpoint: Omit<GptTextCheckpointInput, "checkpointKind">,
  semanticText: string,
): ExactGptTextCheckpointReadback => ({
  checkpointKind: "text",
  sourceAttemptId: String(checkpoint.sourceAttemptId),
  assistantTurnId: String(checkpoint.assistantTurnId),
  artifactRef: String(checkpoint.artifactRef),
  rawDomHtml: `<div data-message-author-role="assistant">${semanticText}</div>`,
  rawDomHash: checkpoint.rawDomHash as `sha256:${string}`,
  semanticText,
  semanticTextHash: checkpoint.semanticTextHash as `sha256:${string}`,
  canonicalConversationUrl: String(checkpoint.canonicalConversationUrl),
  promptHash: checkpoint.promptHash as `sha256:${string}`,
  turnMarker: String(checkpoint.turnMarker),
  evidenceRef: String(checkpoint.evidenceRef),
  evidenceHash: checkpoint.evidenceHash as `sha256:${string}`,
});

const currentCheckpointReadback = (
  state: SeoHarness,
  decision: "proceed" | "decline",
): ExactGptTextCheckpointReadback | ExactGptGeneratedImageCheckpointReadback => {
  const checkpoint = state.currentCheckpoint!;
  if (checkpoint.checkpointKind !== "generated_image") {
    const originMarker = String(state.frontierOriginCheckpoint?.turnMarker);
    const semanticText = String(checkpoint.turnMarker) === originMarker
      ? JSON.stringify(researchOutput(decision))
      : JSON.stringify(articleOutput());
    return textCheckpointReadback(checkpoint, semanticText);
  }
  const predecessor = checkpoint.predecessorTextCheckpoint;
  return {
    checkpointKind: "generated_image",
    sourceAttemptId: String(checkpoint.sourceAttemptId),
    assistantTurnId: String(checkpoint.assistantTurnId),
    canonicalConversationUrl: String(checkpoint.canonicalConversationUrl),
    promptHash: checkpoint.promptHash as `sha256:${string}`,
    mediaHash: checkpoint.mediaHash as `sha256:${string}`,
    turnMarker: String(checkpoint.turnMarker),
    originalArtifactRef: String(checkpoint.originalArtifactRef),
    originalSha256: checkpoint.originalSha256 as `sha256:${string}`,
    originalBytes: new Uint8Array([1]),
    originalMediaType: String(checkpoint.originalMediaType) as `image/${string}`,
    originalWidth: Number(checkpoint.originalWidth),
    originalHeight: Number(checkpoint.originalHeight),
    webpArtifactRef: String(checkpoint.webpArtifactRef),
    webpSha256: checkpoint.webpSha256 as `sha256:${string}`,
    webpBytes: new Uint8Array([1]),
    mediaType: "image/webp",
    width: 1200,
    height: 630,
    evidenceRef: String(checkpoint.evidenceRef),
    evidenceHash: checkpoint.evidenceHash as `sha256:${string}`,
    predecessorTextCheckpoint: textCheckpointReadback(predecessor, JSON.stringify(articleOutput())),
  };
};

const outputForCall = (state: SeoHarness, input: SeoCall, decision: "proceed" | "decline"): unknown => {
  const textAssistantTurnId = input.productStepId === "article_synthesis"
    ? "conversation-turn-4" : "conversation-turn-2";
  const text = input.productStepId === "corpus_research"
    ? JSON.stringify(researchOutput(decision))
    : input.productStepId === "article_synthesis"
      ? JSON.stringify(articleOutput())
      : JSON.stringify({ decision: "no_issue", issues: [] });
  const values: Partial<Record<SeoCall["child"], unknown>> = {
    reconcile_gpt_attachment_set: {
      files: state.materials.map((material, index) => ({
        artifactRef: material.material_id,
        displayName: material.display_name,
        providerDisplayName: state.providerNames[index],
        sha256: HASH,
        bytes: 1,
      })),
    },
    write_exact_gpt_prompt: { hash: HASH },
    reconcile_gpt_turn_submission: {
      canonicalConversationUrl: "https://chatgpt.com/c/example",
      conversationIdentityHash: HASH,
    },
    wait_for_stable_gpt_text: { assistantTurnId: textAssistantTurnId, responseHash: HASH, responseText: text },
    checkpoint_gpt_text_response: {
      assistantTurnId: textAssistantTurnId,
      rawDomHtml: `<div data-message-author-role="assistant">${text}</div>`,
      rawDomHash: HASH, semanticText: text, semanticTextHash: HASH,
    },
    persist_gpt_continuation: { continuationRef: "gpt-continuation:test" },
    wait_for_stable_gpt_image: { assistantTurnId: "conversation-turn-6", mediaHash: HASH },
    checkpoint_gpt_generated_image: {
      artifactId: "image-1", originalBytes: new Uint8Array([1]), webpBytes: new Uint8Array([1]),
      originalSizeBytes: 1, originalMediaType: "image/png", originalWidth: 1200, originalHeight: 630,
      sha256: HASH, originalSha256: HASH, bytes: 1, mediaType: "image/webp", width: 1200, height: 630,
    },
  };
  return values[input.child] ?? {};
};

const applyContinuationCall = (state: SeoHarness, input: SeoCall, initial: unknown): unknown => {
  if (input.child === "persist_gpt_continuation") {
    state.continuationProvider ??= input.input.provider as GptProviderContinuation;
    state.originProvider ??= input.input.provider as GptProviderContinuation;
    state.currentCheckpoint ??= input.input.currentCheckpoint;
    const frontier = input.input.frontier;
    if (frontier) {
      state.frontierRef = frontier.frontierRef as `sha256:${string}`;
      state.frontierOriginCheckpoint = frontier.originCheckpoint;
    }
  }
  if (input.child === "acquire_gpt_continuation_lane") {
    assert.equal(state.continuationLaneOwned, false, "released continuation must be reacquired physically");
    state.continuationLaneVersion += 1;
    state.acquiredLaneVersions.push(state.continuationLaneVersion);
    state.continuationLaneOwned = true;
    return {
      continuation_ref: "gpt-continuation:test",
      lane_version: state.continuationLaneVersion,
      provider: state.continuationProvider,
    };
  }
  if (input.child === "advance_gpt_continuation_lane") {
    assert.equal(state.continuationLaneOwned, true);
    assert.equal(input.input.lane.lane_version,
      state.continuationLaneVersion);
    state.continuationProvider = input.input.provider as GptProviderContinuation;
    state.currentCheckpoint = input.input.currentCheckpoint;
    state.continuationLaneOwned = false;
  }
  if (input.child === "release_gpt_continuation_lane") {
    assert.equal(input.input.lane.lane_version,
      state.continuationLaneVersion);
    state.continuationLaneOwned = false;
  }
  return initial;
};

const assertSeoCallBoundary = (_state: SeoHarness, input: SeoCall): void => {
  if (input.child === "checkpoint_gpt_generated_image") {
    const predecessor = input.input.predecessorTextCheckpoint;
    assert.equal(predecessor.assistantTurnId, "conversation-turn-4");
    assert.equal(input.input.assistantTurnId, "conversation-turn-6");
    assert.notEqual(predecessor.promptHash, input.input.expectedPromptHash,
      "direct predecessor keeps the article prompt hash instead of impersonating the image prompt");
    assert.notEqual(predecessor.turnMarker, input.input.turnMarker,
      "direct predecessor keeps the article marker instead of impersonating the image marker");
    return;
  }
  if (input.child !== "attach_approved_gpt_files_once"
    && input.child !== "reconcile_gpt_attachment_set") return;
  assert(Array.isArray(input.input.files));
  for (const file of input.input.files) {
    assert(file && typeof file === "object" && !Array.isArray(file));
    assert.deepEqual(Object.keys(file).sort(), ["artifactRef", "bytes", "displayName", "sha256"],
      "Product to GPT attachment input must contain exactly the four approved-file fields");
    assert.equal("providerDisplayName" in file, false,
      "providerDisplayName is derived by GPT and must not enter attachment input");
  }
};

const throwConfiguredSeoFailure = (
  state: SeoHarness,
  input: SeoCall,
  failureAt: SeoFailure | undefined,
  attemptId: string,
): void => {
  const matches = state.remainingFailures > 0 && input.child === failureAt?.child
    && (!failureAt.productStepId || input.productStepId === failureAt.productStepId);
  if (!matches || !failureAt) return;
  state.remainingFailures -= 1;
  if (!failureAt.confirmedSubmit) {
    throw executionFailure("failed", failureAt.code, {
      metadata: Object.freeze({ mutationOutcome: "no" }),
    });
  }
  assert.equal(input.child, "submit_exact_gpt_turn_once");
  const priorFact = state.factsByCall.get(factKey(attemptId, input));
  if (!priorFact) state.physicalSubmitDispatches += 1;
  const evidenceRef = priorFact?.evidenceRef ?? `evidence:${state.calls.length}`;
  state.factsByCall.set(factKey(attemptId, input), {
    attemptId, callIdentityHash: callIdentityHash(input), evidenceRef,
    failureCode: failureAt.code, mutation: true, terminalAt: CONFIRMED_AT,
  });
  throw executionFailure("failed", failureAt.code, {
    metadata: Object.freeze({
      mutationOutcome: "confirmed",
      evidence: Object.freeze({ evidenceRef: "browser-mutation:test", evidenceHash: HASH }),
      browserEffect: Object.freeze({
        effectScope: "provider_effect", childCapabilityId: "submit_exact_gpt_turn_once",
        browserOutcome: "CONFIRMED",
      }),
    }),
  });
};

const recordSuccessfulSeoCall = (
  state: SeoHarness,
  input: SeoCall,
  attemptId: string,
): string => {
  const priorFact = state.factsByCall.get(factKey(attemptId, input));
  if (input.child === "submit_exact_gpt_turn_once" && !priorFact) state.physicalSubmitDispatches += 1;
  const evidenceRef = priorFact?.evidenceRef ?? `evidence:${state.calls.length}`;
  state.factsByCall.set(factKey(attemptId, input), {
    attemptId, callIdentityHash: callIdentityHash(input), evidenceRef, failureCode: null,
    mutation: input.child === "submit_exact_gpt_turn_once",
    terminalAt: input.child === "submit_exact_gpt_turn_once" ? CONFIRMED_AT : null,
  });
  return evidenceRef;
};

const executeCall = async (
  state: SeoHarness,
  input: SeoCall,
  decision: "proceed" | "decline",
  failureAt?: SeoFailure,
  attemptId = "attempt-1",
) => {
  assertSeoCallBoundary(state, input);
  state.calls.push(input);
  throwConfiguredSeoFailure(state, input, failureAt, attemptId);
  if (state.remainingLocatorFailures > 0 && failureAt?.locatorFailureCode
    && input.child === "reconcile_gpt_turn_submission"
    && input.productStepId === failureAt.productStepId) {
    state.remainingLocatorFailures -= 1;
    throw executionFailure("failed", failureAt.locatorFailureCode, {
      metadata: Object.freeze({ mutationOutcome: "no" }),
    });
  }
  const value = applyContinuationCall(state, input, outputForCall(state, input, decision));
  const evidenceRef = recordSuccessfulSeoCall(state, input, attemptId);
  return { value, evidenceRef, evidenceHash: HASH };
};

const readSeoContinuation = (
  state: SeoHarness,
  decision: "proceed" | "decline",
): SharedExecutionContext["gpt"]["readContinuationExact"] => async (query) => {
  if (query.lookupKind === "turn_marker") {
    return state.continuationProvider
      && state.continuationProvider.prior_turn_marker === query.turnMarker ? {
        lookupKind: "turn_marker" as const,
        lane: { continuation_ref: "gpt-continuation:test",
          lane_version: state.continuationLaneVersion, provider: state.continuationProvider },
      } : null;
  }
  if (query.frontierRef !== state.frontierRef || !state.originProvider
    || !state.frontierOriginCheckpoint || !state.continuationProvider
    || !state.currentCheckpoint) return null;
  const checkpoint = state.frontierOriginCheckpoint;
  return {
    lookupKind: "frontier_ref" as const,
    continuationRef: "gpt-continuation:test",
    authorizationReadback: query.authorization.kind === "origin_authorization" ? {
      kind: "origin_authorization" as const,
      originAuthorizationRef: query.authorization.originAuthorizationRef,
    } : {
      kind: "current_artifact_read_grant" as const,
      currentAuthorizationRef: query.authorization.currentAuthorizationRef,
      ownerScopeHash: HASH, subjectRef: "subject:test", sourceArtifactRef: checkpoint.artifactRef,
      sourceCheckpointRef: HASH, semanticAdmissionReceiptRef: "receipt:semantic",
      semanticAdmissionReceiptHash: HASH, opaqueReadGrantHash: query.authorization.opaqueReadGrantHash,
    },
    originProvider: state.originProvider,
    originCheckpoint: textCheckpointReadback(checkpoint, JSON.stringify(researchOutput(decision))),
    currentProvider: state.continuationProvider,
    currentCheckpoint: currentCheckpointReadback(state, decision),
  };
};

const readSeoCallFacts = (
  state: SeoHarness,
  attemptId: string,
): SharedExecutionContext["gpt"]["readCallFacts"] => async (input) => {
  const current = state.factsByCall.get(factKey(attemptId, input));
  const stored = current;
  const facts: ExactGptCallFacts = {
    exactCallIdentityHash: HASH,
    mutation: stored?.mutation ? {
      owner: "browser", sourceAttemptId: stored.attemptId,
      effectScope: "provider_effect", outcome: "CONFIRMED", terminalAt: stored.terminalAt,
      productStepId: input.productStepId, callId: input.callId,
      childCapabilityId: input.child, actionOrdinal: input.actionOrdinal,
    } : null,
    evidence: stored && !stored.failureCode ? {
      owner: "forensics-persistence", evidenceRef: stored.evidenceRef, evidenceHash: HASH,
      readbackVerified: true,
      artifactRefs: input.child === "checkpoint_gpt_text_response" ? [`artifact:${input.productStepId}`]
        : input.child === "checkpoint_gpt_generated_image"
          ? ["artifact:image-original", "artifact:image-webp", "artifact:image-receipt"] : [],
    } : null,
    continuation: null,
  };
  return stored?.failureCode && stored.mutation ? {
    ...facts,
    confirmedProviderSubmitReceipt: {
      exactCallIdentityHash: HASH,
      terminalAt: stored.terminalAt!,
      evidenceRef: stored.evidenceRef,
      evidenceHash: HASH,
    },
  } : facts;
};

const completeSeo = (
  state: SeoHarness,
): SharedExecutionContext["complete"] => async (output) => {
  if (state.completionFailuresRemaining > 0) {
    state.completionFailuresRemaining -= 1;
    throw executionFailure("failed", "WEBSITE_COMPLETION_TEST_FAULT");
  }
  const payload = output.payload as Readonly<Record<string, unknown>>;
  if (payload.image) {
    assert.equal(state.generatedImageUploadCalls, 1,
      "the image receipt must exist before Product final assembly and completion");
  }
  state.completed = output;
  return {} as Awaited<ReturnType<SharedExecutionContext["complete"]>>;
};

export const createContext = (
  state: SeoHarness,
  decision: "proceed" | "decline",
  failureAt?: SeoFailure,
  attemptId = "attempt-1",
): SharedExecutionContext => ({
  materials: state.materials,
  routePolicy: productionRoutePolicy("public_knowledge_article_pipeline", state.actionId),
  productSkill: Object.freeze({ text: "fixture public knowledge skill", hash: HASH }),
  gpt: {
    jobId: `job-${state.actionId}`,
    attemptId,
    readContinuationExact: readSeoContinuation(state, decision),
    readCallFacts: readSeoCallFacts(state, attemptId),
    execute: async (input: SeoExecuteInput) => {
      const result = await executeCall(state, input as SeoCall, decision, failureAt, attemptId);
      return { ...result, value: result.value } as never;
    },
  },
  uploadGeneratedImage: async (artifact) => {
    if (!state.uploadedImageHashes.has(artifact.sha256)) {
      state.uploadedImageHashes.add(artifact.sha256);
      state.generatedImageUploadCalls += 1;
    }
    return Object.freeze({
      artifact_id: artifact.artifact_id,
      object_ref: `object:${artifact.artifact_id}`,
      sha256: artifact.sha256,
      receipt_hash: HASH,
      bytes: artifact.bytes,
      mime_type: artifact.media_type,
      width: artifact.width,
      height: artifact.height,
    });
  },
  complete: completeSeo(state),
});

export const withFastHandoffs = async <T>(state: SeoHarness, run: () => Promise<T>): Promise<T> => {
  const nativeSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((handler: (...args: unknown[]) => void, timeout?: number, ...args: unknown[]) => {
    state.handoffDelays.push(timeout ?? 0);
    return nativeSetTimeout(() => handler(...args), 0);
  }) as typeof setTimeout;
  try {
    return await run();
  } finally {
    globalThis.setTimeout = nativeSetTimeout;
  }
};
