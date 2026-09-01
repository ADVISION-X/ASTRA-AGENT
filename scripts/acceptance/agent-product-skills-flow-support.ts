import assert from "../audit/shared/governance-exam-assert.js";

import {
  gptAttachmentProviderDisplayName,
  type GptProviderContinuation,
} from "../../src/capabilities/gpt/index.js";
import {
  hashCanonical,
  type WebsiteAgentTask,
} from "../../src/lib/local-runtime/production/contracts.js";
import type {
  ExactGptGeneratedImageCheckpointReadback,
  ExactGptTextCheckpointReadback,
  ProductPluginOutput,
  ProductPlugin,
  SharedExecutionContext,
} from "../../src/lib/local-runtime/production/plugin.js";
import { executionFailure } from "../../src/lib/typed-failure.js";
import { task } from "./agent-production-runtime-fixtures.js";

const HASH = `sha256:${"1".repeat(64)}` as const;
const CONFIRMED_AT = new Date(Date.now() - 1_000).toISOString();

export const researchOutput = (decision: "proceed" | "decline") => ({
  schema_version: "public-knowledge-research-output.v3", decision,
  topic_manifest: {
    primary_question: "旺衰判断为何不能只数五行？", answer_scope: "解释判断条件",
    excluded_scope: "不做个人命盘", primary_cluster_id: "bazi-strength-balance",
    secondary_cluster_ids: [], reader_level: "introductory", concept_keys: ["旺衰"],
    relation_keys: ["条件"], method_scope: ["古籍解释"],
  },
  editorial_intent: "说明判断边界", catalog_comparison_note: "独立问题",
  research_markdown: "研究工件", citations: [], uncertainties: [], research_claim_units: [],
  closest_existing_article_ids: [], relation_assertions: [], novelty_basis: "independent_question",
});
export const articleOutput = () => ({
  schema_version: "public-knowledge-article-output.v3", title: "旺衰判断的条件",
  editor_note: "说明边界", article_markdown: "## 判断边界\n不能机械计数。",
  citations: [], claim_coverage: [], safety_notes: [],
});

type SeoAction = "produce_article" | "accuracy_challenge" | "quality_reflection";
type SeoCall = Parameters<SharedExecutionContext["gpt"]["execute"]>[0];
type SeoFactQuery = Parameters<SharedExecutionContext["gpt"]["readCallFacts"]>[0];
export type SeoFailure = Readonly<{ child: string; code: string; productStepId?: string }>;
type SeoFact = Readonly<{
  attemptId: string;
  callIdentityHash: string;
  evidenceRef: string;
  mutation: boolean;
  terminalAt: string | null;
}>;
export type SeoHarness = {
  calls: SeoCall[];
  factsByCall: Map<string, SeoFact>;
  handoffDelays: number[];
  completed: ProductPluginOutput | null;
  continuationProvider: GptProviderContinuation | null;
  originProvider: GptProviderContinuation | null;
  frontierRef: `sha256:${string}` | null;
  frontierOriginCheckpoint: Readonly<Record<string, unknown>> | null;
  currentCheckpoint: Readonly<Record<string, unknown>> | null;
  completionFailuresRemaining: number;
  continuationLaneVersion: number;
  continuationLaneOwned: boolean;
  remainingFailures: number;
  physicalSubmitDispatches: number;
  acquiredLaneVersions: number[];
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
    acquiredLaneVersions: [],
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
  checkpoint: Readonly<Record<string, unknown>>,
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
  const predecessor = checkpoint.predecessorTextCheckpoint as Readonly<Record<string, unknown>>;
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
    state.currentCheckpoint ??= input.input.currentCheckpoint as Readonly<Record<string, unknown>>;
    const frontier = input.input.frontier as Readonly<Record<string, unknown>> | undefined;
    if (frontier) {
      state.frontierRef = frontier.frontierRef as `sha256:${string}`;
      state.frontierOriginCheckpoint = frontier.originCheckpoint as Readonly<Record<string, unknown>>;
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
    assert.equal((input.input.lane as Readonly<Record<string, unknown>>).lane_version,
      state.continuationLaneVersion);
    state.continuationProvider = input.input.provider as GptProviderContinuation;
    state.currentCheckpoint = input.input.currentCheckpoint as Readonly<Record<string, unknown>>;
    state.continuationLaneOwned = false;
  }
  if (input.child === "release_gpt_continuation_lane") {
    assert.equal((input.input.lane as Readonly<Record<string, unknown>>).lane_version,
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
  state.calls.push(input);
  if (state.remainingFailures > 0 && input.child === failureAt?.child
    && (!failureAt.productStepId || input.productStepId === failureAt.productStepId)) {
    state.remainingFailures -= 1;
    throw executionFailure("failed", failureAt.code);
  }
  const value = applyContinuationCall(state, input, outputForCall(state, input, decision));
  const priorFact = state.factsByCall.get(factKey(attemptId, input));
  if (input.child === "submit_exact_gpt_turn_once" && !priorFact) state.physicalSubmitDispatches += 1;
  const evidenceRef = priorFact?.evidenceRef ?? `evidence:${state.calls.length}`;
  state.factsByCall.set(factKey(attemptId, input), {
    attemptId,
    callIdentityHash: callIdentityHash(input),
    evidenceRef,
    mutation: input.child === "submit_exact_gpt_turn_once",
    terminalAt: input.child === "submit_exact_gpt_turn_once" ? CONFIRMED_AT : null,
  });
  return { value, evidenceRef, evidenceHash: HASH };
};

export const createContext = (
  state: SeoHarness,
  decision: "proceed" | "decline",
  failureAt?: SeoFailure,
  attemptId = "attempt-1",
): SharedExecutionContext => ({
  materials: state.materials,
  gpt: {
    attemptId,
    readContinuationExact: async (query) => {
      if (query.lookupKind === "turn_marker") {
        return state.continuationProvider
          && state.continuationProvider.prior_turn_marker === query.turnMarker ? {
            lookupKind: "turn_marker" as const,
            lane: {
              continuation_ref: "gpt-continuation:test",
              lane_version: state.continuationLaneVersion,
              provider: state.continuationProvider,
            },
          } : null;
      }
      if (query.frontierRef !== state.frontierRef || !state.originProvider
        || !state.frontierOriginCheckpoint || !state.continuationProvider
        || !state.currentCheckpoint) return null;
      const checkpoint = state.frontierOriginCheckpoint;
      return {
        lookupKind: "frontier_ref" as const,
        continuationRef: "gpt-continuation:test",
        originProvider: state.originProvider,
        originCheckpoint: textCheckpointReadback(
          checkpoint, JSON.stringify(researchOutput(decision)),
        ),
        currentProvider: state.continuationProvider,
        currentCheckpoint: currentCheckpointReadback(state, decision),
      };
    },
    readCallFacts: async (input) => {
      const lookupKind = input.lookupKind ?? "current_attempt";
      const stored = lookupKind === "current_attempt"
        ? state.factsByCall.get(factKey(attemptId, input))
        : [...state.factsByCall.values()].filter((fact) =>
          fact.attemptId !== attemptId && fact.callIdentityHash === callIdentityHash(input))[0];
      return {
        exactCallIdentityHash: HASH,
        mutation: stored?.mutation ? {
          owner: "browser", sourceAttemptId: stored.attemptId,
          effectScope: "provider_effect", outcome: "CONFIRMED", terminalAt: stored.terminalAt,
          targetRef: "target:fixture", documentRef: "document:fixture",
          productStepId: input.productStepId, callId: input.callId,
          childCapabilityId: input.child, actionOrdinal: input.actionOrdinal,
        } : null,
        evidence: stored ? {
          owner: "forensics-persistence", evidenceRef: stored.evidenceRef, evidenceHash: HASH,
          readbackVerified: true,
          artifactRefs: input.child === "checkpoint_gpt_text_response"
            ? [`artifact:${input.productStepId}`]
            : input.child === "checkpoint_gpt_generated_image"
              ? ["artifact:image-original", "artifact:image-webp", "artifact:image-receipt"]
              : [],
        } : null,
        continuation: null,
      };
    },
    execute: (input) => executeCall(state, input, decision, failureAt, attemptId),
  },
  complete: async (output) => {
    if (state.completionFailuresRemaining > 0) {
      state.completionFailuresRemaining -= 1;
      throw executionFailure("failed", "WEBSITE_COMPLETION_TEST_FAULT");
    }
    state.completed = output;
    return {} as Awaited<ReturnType<SharedExecutionContext["complete"]>>;
  },
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
    assert.equal(state.handoffDelays.length, Math.max(0, state.calls.length - 1));
  }
  assert.equal(new Set(state.calls.map((call) => call.sessionKey)).size, 1);
  assert.ok(state.calls.every((call) => call.sessionKey.includes("attempt-1")));
  assert.ok(state.handoffDelays.every((delay) => delay === 2_000),
    "every adjacent SEO Child must retain a 2s handoff floor");
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
  };
};
