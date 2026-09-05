import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";

import {
  gptAttachmentProviderDisplayName,
  type ExactGptContinuationReadback,
  type GptContinuationCheckpointInput,
  type ProductGptAnyCallInput,
  type ProductGptTools,
  type GptProviderContinuation,
} from "../../../src/capabilities/gpt/index.js";
import {
  hashCanonical,
  type WebsiteAgentTask,
  type ProductPluginOutput,
  type ProductPlugin,
  type SharedExecutionContext,
} from "../../../src/mediator/product-plugin-contract.js";
import { productionRoutePolicy } from "../../../src/lib/local-runtime/production/route-policy.js";
import { executionFailure } from "../../../src/lib/execution-failure.js";
import { task } from "../agent-production-runtime-fixtures.js";
import { articleOutput, researchOutput } from
  "./public-knowledge-article-pipeline-output-fixtures.js";

const HASH = `sha256:${"1".repeat(64)}` as const;
const CONFIRMED_AT = new Date(Date.now() - 1_000).toISOString();

type SeoAction = "produce_article" | "accuracy_challenge" | "quality_reflection";
type SeoCall = ProductGptAnyCallInput & Readonly<{ sessionKey: string }>;
type SeoExecuteInput = Parameters<ProductGptTools["execute"]>[0];
type GptTextCheckpointInput = Extract<GptContinuationCheckpointInput, { checkpointKind: "text" }>;
type FrontierReadback = Extract<ExactGptContinuationReadback, { lookupKind: "frontier_ref" }>;
type ExactGptTextCheckpointReadback = FrontierReadback["originCheckpoint"];
type ExactGptGeneratedImageCheckpointReadback = Extract<
  FrontierReadback["currentCheckpoint"], { checkpointKind: "generated_image" }
>;
type SeoFactQuery = Parameters<SharedExecutionContext["gpt"]["readCallFacts"]>[0];
export type SeoFailure = Readonly<{
  child: string;
  code: string;
  productStepId?: string;
  confirmedSubmit?: boolean;
  locatorFailureCode?: string;
}>;
type SeoFact = Readonly<{
  attemptId: string;
  callIdentityHash: string;
  evidenceRef: string;
  failureCode: string | null;
  mutation: boolean;
  terminalAt: string | null;
}>;
export type SeoHarness = {
  actionId: SeoAction;
  calls: SeoCall[];
  factsByCall: Map<string, SeoFact>;
  handoffDelays: number[];
  completed: ProductPluginOutput | null;
  continuationProvider: GptProviderContinuation | null;
  originProvider: GptProviderContinuation | null;
  frontierRef: `sha256:${string}` | null;
  frontierOriginCheckpoint: Omit<GptTextCheckpointInput, "checkpointKind"> | null;
  currentCheckpoint: GptContinuationCheckpointInput | null;
  completionFailuresRemaining: number;
  continuationLaneVersion: number;
  continuationLaneOwned: boolean;
  remainingFailures: number;
  physicalSubmitDispatches: number;
  generatedImageUploadCalls: number;
  uploadedImageHashes: Set<string>;
  acquiredLaneVersions: number[];
  confirmedReadbackAuthorizationByStep: Map<string, "source-only" | "full">;
  materials: SharedExecutionContext["materials"];
  providerNames: readonly string[];
};

export const seoTask = (actionId: SeoAction): WebsiteAgentTask => task({
  jobId: `job-${actionId}`,
  productId: "public_knowledge_article_pipeline",
  actionId,
  extra: {
    parameters: { domain_id: "bazi", locale: "zh-CN", ready_corpus_snapshot_hash: HASH },
    ...(actionId === "produce_article" ? {} : {
      subject_task_ref: "subject-task", subject_result_ref: "subject-result",
      subject_result_hash: HASH, review_policy: "strict",
    }),
  },
});

const fixtureMaterials = (actionId: SeoAction): SharedExecutionContext["materials"] => actionId === "produce_article"
  ? [{ material_id: "m0", ordinal: 0, role: "ready_corpus_archive", display_name: "public-knowledge-materials.zip",
    object_ref: "object:m0", local_path: "/tmp/public-knowledge-materials.zip", sha256: HASH, bytes: 1,
    media_type: "application/zip", storage_class: "shared_static", owner_scope_hash: null,
    trust_class: "classical_source_data", may_issue_instruction: false }]
  : [
    { material_id: "m0", ordinal: 0, role: "subject_result", display_name: "one.json",
      object_ref: "object:m0", local_path: "/tmp/one.json", sha256: HASH, bytes: 1,
      media_type: "application/json", storage_class: "shared_static", owner_scope_hash: null,
      trust_class: "locked_fact", may_issue_instruction: false },
    { material_id: "m1", ordinal: 1, role: "review_contract", display_name: "two.json",
      object_ref: "object:m1", local_path: "/tmp/two.json", sha256: HASH, bytes: 1,
      media_type: "application/json", storage_class: "shared_static", owner_scope_hash: null,
      trust_class: "locked_fact", may_issue_instruction: false },
  ];

export const createHarness = (actionId: SeoAction, failureAt?: SeoFailure): SeoHarness => {
  const materials = fixtureMaterials(actionId);
  return {
    actionId,
    calls: [],
    factsByCall: new Map(),
    handoffDelays: [],
    completed: null,
    continuationProvider: null,
    originProvider: null,
    frontierRef: null,
    frontierOriginCheckpoint: null,
    currentCheckpoint: null,
    completionFailuresRemaining: 0,
    continuationLaneVersion: 0,
    continuationLaneOwned: false,
    remainingFailures: failureAt ? 1 : 0,
    physicalSubmitDispatches: 0,
    generatedImageUploadCalls: 0,
    uploadedImageHashes: new Set(),
    acquiredLaneVersions: [],
    confirmedReadbackAuthorizationByStep: new Map(),
    materials,
    providerNames: materials.map((material) => gptAttachmentProviderDisplayName(
      material.display_name, "attempt-1", material.material_id,
    )),
  };
};

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
  const marker = `[GRASSEYE:${"a".repeat(24)}]`;
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
    reconcile_gpt_turn_submission: { canonicalConversationUrl: "https://chatgpt.com/c/example" },
    wait_for_stable_gpt_text: { assistantTurnId: "conversation-turn-2", responseHash: HASH, responseText: text },
    checkpoint_gpt_text_response: {
      assistantTurnId: "conversation-turn-2",
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

const executeCall = async (
  state: SeoHarness,
  input: SeoCall,
  decision: "proceed" | "decline",
  failureAt?: SeoFailure,
  attemptId = "attempt-1",
) => {
  if (state.confirmedReadbackAuthorizationByStep.get(input.productStepId) === "source-only") {
    assert.equal(
      input.child,
      "reconcile_gpt_turn_submission",
      "source-only confirmed-submit recovery must close the existing submission locator before any other Child",
    );
  }
  if (input.child === "attach_approved_gpt_files_once"
    || input.child === "reconcile_gpt_attachment_set") {
    assert(Array.isArray(input.input.files));
    for (const file of input.input.files) {
      assert(file && typeof file === "object" && !Array.isArray(file));
      assert.deepEqual(Object.keys(file).sort(), ["artifactRef", "bytes", "displayName", "sha256"],
        "Product to GPT attachment input must contain exactly the four approved-file fields");
      assert.equal("providerDisplayName" in file, false,
        "providerDisplayName is derived by GPT and must not enter attachment input");
    }
  }
  state.calls.push(input);
  if (state.remainingFailures > 0 && input.child === failureAt?.child
    && (!failureAt.productStepId || input.productStepId === failureAt.productStepId)) {
    state.remainingFailures -= 1;
    if (failureAt.confirmedSubmit) {
      assert.equal(input.child, "submit_exact_gpt_turn_once");
      const priorFact = state.factsByCall.get(factKey(attemptId, input));
      if (!priorFact) state.physicalSubmitDispatches += 1;
      const evidenceRef = priorFact?.evidenceRef ?? `evidence:${state.calls.length}`;
      state.factsByCall.set(factKey(attemptId, input), {
        attemptId,
        callIdentityHash: callIdentityHash(input),
        evidenceRef,
        failureCode: failureAt.code,
        mutation: true,
        terminalAt: CONFIRMED_AT,
      });
      throw executionFailure("failed", failureAt.code, {
        metadata: Object.freeze({
          mutationOutcome: "confirmed",
          evidence: Object.freeze({ evidenceRef: "browser-mutation:test", evidenceHash: HASH }),
          browserEffect: Object.freeze({
            effectScope: "provider_effect",
            childCapabilityId: "submit_exact_gpt_turn_once",
            browserOutcome: "CONFIRMED",
          }),
        }),
      });
    }
    throw executionFailure("failed", failureAt.code, {
      metadata: Object.freeze({ mutationOutcome: "no" }),
    });
  }
  if (failureAt?.locatorFailureCode
    && input.child === "reconcile_gpt_turn_submission"
    && input.productStepId === failureAt.productStepId) {
    throw executionFailure("failed", failureAt.locatorFailureCode, {
      metadata: Object.freeze({ mutationOutcome: "no" }),
    });
  }
  const value = applyContinuationCall(state, input, outputForCall(state, input, decision));
  if (input.child === "reconcile_gpt_turn_submission"
    && state.confirmedReadbackAuthorizationByStep.get(input.productStepId) === "source-only") {
    state.confirmedReadbackAuthorizationByStep.set(input.productStepId, "full");
  }
  const priorFact = state.factsByCall.get(factKey(attemptId, input));
  if (input.child === "submit_exact_gpt_turn_once" && !priorFact) state.physicalSubmitDispatches += 1;
  const evidenceRef = priorFact?.evidenceRef ?? `evidence:${state.calls.length}`;
  state.factsByCall.set(factKey(attemptId, input), {
    attemptId,
    callIdentityHash: callIdentityHash(input),
    evidenceRef,
    failureCode: null,
    mutation: input.child === "submit_exact_gpt_turn_once",
    terminalAt: input.child === "submit_exact_gpt_turn_once" ? CONFIRMED_AT : null,
  });
  return { value, evidenceRef, evidenceHash: HASH };
};

const readSeoContinuation = (
  state: SeoHarness,
  decision: "proceed" | "decline",
  attemptId = "attempt-1",
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
  const lookupKind = input.lookupKind ?? "current_attempt";
  const current = state.factsByCall.get(factKey(attemptId, input));
  if (lookupKind === "task_exact_effect" && current) {
    throw executionFailure("failed", "GPT_TASK_EXACT_EFFECT_CURRENT_ATTEMPT_PRESENT");
  }
  const stored = lookupKind === "current_attempt"
    ? current
    : [...state.factsByCall.values()].filter((fact) =>
      fact.attemptId !== attemptId && fact.callIdentityHash === callIdentityHash(input))[0];
  if (stored?.failureCode) {
    throw executionFailure("failed", stored.failureCode, {
      metadata: Object.freeze({ mutationOutcome: stored.mutation ? "confirmed" : "no" }),
    });
  }
  return {
    exactCallIdentityHash: HASH,
    mutation: stored?.mutation ? {
      owner: "browser", sourceAttemptId: stored.attemptId,
      effectScope: "provider_effect", outcome: "CONFIRMED", terminalAt: stored.terminalAt,
      productStepId: input.productStepId, callId: input.callId,
      childCapabilityId: input.child, actionOrdinal: input.actionOrdinal,
    } : null,
    evidence: stored ? {
      owner: "forensics-persistence", evidenceRef: stored.evidenceRef, evidenceHash: HASH,
      readbackVerified: true,
      artifactRefs: input.child === "checkpoint_gpt_text_response" ? [`artifact:${input.productStepId}`]
        : input.child === "checkpoint_gpt_generated_image"
          ? ["artifact:image-original", "artifact:image-webp", "artifact:image-receipt"] : [],
    } : null,
    continuation: null,
  };
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
    attemptId,
    readContinuationExact: readSeoContinuation(state, decision, attemptId),
    readConfirmedSubmitFailure: async (input) => {
      if (input.child !== "submit_exact_gpt_turn_once") return null;
      const stored = state.factsByCall.get(factKey(attemptId, input));
      if (!stored?.failureCode || !stored.mutation || !stored.terminalAt) return null;
      state.confirmedReadbackAuthorizationByStep.set(input.productStepId, "source-only");
      return Object.freeze({
        sourceAttemptId: stored.attemptId,
        exactCallIdentityHash: HASH,
        productStepId: input.productStepId,
        callId: input.callId,
        actionOrdinal: input.actionOrdinal,
        terminalAt: stored.terminalAt,
        failureCode: stored.failureCode,
        evidenceRef: stored.evidenceRef,
        evidenceHash: HASH,
      });
    },
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

const runPlugin = async (
  plugin: ProductPlugin,
  taskInput: WebsiteAgentTask,
  context: SharedExecutionContext,
  state: SeoHarness,
  recoverAfterFault: boolean,
): Promise<unknown> => {
  return withFastHandoffs(state, async () => {
    let firstFailure: unknown = null;
    try { await plugin.execute(taskInput, context); }
    catch (error) {
      if (!recoverAfterFault) throw error;
      firstFailure = error;
    }
    if (recoverAfterFault) await plugin.execute(taskInput, context);
    return firstFailure;
  });
};

const assertHarness = (state: SeoHarness, actionId: SeoAction, recoverAfterFault: boolean): ProductPluginOutput => {
  const output = state.completed;
  assert(output);
  if (!recoverAfterFault) {
    assert.deepEqual(state.calls.map((call) => call.actionOrdinal),
      state.calls.map((_call, index) => index + 1));
    assert.deepEqual(output.evidence_refs, state.calls.map((_call, index) => `evidence:${index + 1}`));
    assert.equal(state.handoffDelays.length, 0,
      "SEO Product must not schedule fixed sleeps between GPT Children");
  }
  assert.equal(new Set(state.calls.map((call) => call.sessionKey)).size, 1);
  assert.ok(state.calls.every((call) => call.sessionKey.includes("attempt-1")));
  assert.equal(state.handoffDelays.length, 0,
    "SEO Product must derive handoff readiness from each Child fact, not elapsed time");
  const firstPrompt = state.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt;
  assert.equal(typeof firstPrompt, "string");
  if (actionId === "produce_article") {
    assert.equal(state.providerNames.length, 1);
    assert.match(firstPrompt as string, new RegExp(state.providerNames[0]!, "u"));
    assert.match(firstPrompt as string, /解压并读取本轮唯一 ZIP 附件/u);
    assert.match(firstPrompt as string, /原文\.md 与索引\.json/u);
    assert.match(firstPrompt as string, /public-knowledge-research-output\.v3/u);
    assert.match(firstPrompt as string, /本回合不得返回 article package/u);
    assert.doesNotMatch(firstPrompt as string, /ready_corpus_snapshot_hash|sha256:/u);
  } else {
    assert.match(firstPrompt as string, new RegExp(`${state.providerNames[0]} 与 ${state.providerNames[1]}`, "u"));
  }
  const files = state.calls.find((call) => call.child === "reconcile_gpt_draft")?.input.files;
  assert.deepEqual(Array.isArray(files)
    ? files.map((file) => (file as { providerDisplayName?: unknown }).providerDisplayName) : null,
  state.providerNames);
  return output;
};

export const exerciseSeoFlow = async (
  plugin: ProductPlugin,
  actionId: SeoAction,
  decision: "proceed" | "decline" = "proceed",
  failureAt?: SeoFailure,
  recoverAfterFault = false,
) => {
  const state = createHarness(actionId, failureAt);
  const firstFailure = await runPlugin(
    plugin, seoTask(actionId), createContext(state, decision, failureAt), state, recoverAfterFault,
  );
  const completed = assertHarness(state, actionId, recoverAfterFault);
  return {
    calls: state.calls, completed, firstFailure,
    physicalSubmitDispatches: state.physicalSubmitDispatches,
    acquiredLaneVersions: state.acquiredLaneVersions,
    generatedImageUploadCalls: state.generatedImageUploadCalls,
  };
};

export const exerciseSeoAttachmentReconcileFailure = async (plugin: ProductPlugin) => {
  const failureAt = Object.freeze({
    child: "reconcile_gpt_attachment_set" as const,
    code: "GPT_ATTACHMENT_UPLOAD_TIMEOUT",
    productStepId: "corpus_research",
  });
  const state = createHarness("produce_article", failureAt);
  let failure: unknown = null;
  try {
    await withFastHandoffs(state, () => plugin.execute(
      seoTask("produce_article"), createContext(state, "proceed", failureAt),
    ));
  } catch (error) {
    failure = error;
  }
  assert(failure, "attachment reconciliation failure must stop the Product flow");
  return Object.freeze({ calls: Object.freeze([...state.calls]), failure,
    physicalSubmitDispatches: state.physicalSubmitDispatches });
};

export const exerciseSeoPromptWriteFailure = async (plugin: ProductPlugin) => {
  const failureAt = Object.freeze({
    child: "write_exact_gpt_prompt" as const,
    code: "GPT_PROMPT_WRITE_UNCONFIRMED",
    productStepId: "corpus_research",
  });
  const state = createHarness("produce_article", failureAt);
  let failure: unknown = null;
  try {
    await withFastHandoffs(state, () => plugin.execute(
      seoTask("produce_article"), createContext(state, "proceed", failureAt),
    ));
  } catch (error) {
    failure = error;
  }
  assert(failure, "prompt write failure must stop the Product flow before draft reconciliation and submit");
  return Object.freeze({ calls: Object.freeze([...state.calls]), failure,
    physicalSubmitDispatches: state.physicalSubmitDispatches });
};
