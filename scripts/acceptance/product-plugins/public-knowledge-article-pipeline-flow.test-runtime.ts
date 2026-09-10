import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";

import type { ProductPlugin, ProductPluginOutput, WebsiteAgentTask,
  SharedExecutionContext } from "../../../src/mediator/product-plugin-contract.js";
import { createContext, withFastHandoffs } from
  "./public-knowledge-article-pipeline.test-runtime.js";
import { createHarness, seoTask, type SeoAction, type SeoCall, type SeoFailure, type SeoHarness } from
  "./public-knowledge-article-pipeline-fixture-state.js";

const runPlugin = async (
  plugin: ProductPlugin,
  taskInput: WebsiteAgentTask,
  context: SharedExecutionContext,
  state: SeoHarness,
  recoverAfterFault: boolean,
): Promise<unknown> => withFastHandoffs(state, async () => {
  let firstFailure: unknown = null;
  try { await plugin.execute(taskInput, context); }
  catch (error) {
    if (!recoverAfterFault) throw error;
    firstFailure = error;
  }
  if (recoverAfterFault) await plugin.execute(taskInput, context);
  return firstFailure;
});

const assertHarness = (
  state: SeoHarness,
  actionId: SeoAction,
  recoverAfterFault: boolean,
  attemptId: string,
): ProductPluginOutput => {
  const output = state.completed;
  assert(output);
  if (!recoverAfterFault) {
    const expectedOrdinals = (stepId: string): readonly number[] => stepId === "article_synthesis"
      ? [1, 2, 3, 4, 5, 6, 7, 27, 29, 31]
      : stepId === "article_image_generation"
        ? [1, 2, 3, 4, 5, 6, 7, 37, 38, 39, 40, 41, 42, 43, 45, 47]
        : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15];
    const callsByStep = new Map<string, SeoCall[]>();
    for (const call of state.calls) callsByStep.set(call.productStepId, [
      ...(callsByStep.get(call.productStepId) ?? []), call,
    ]);
    for (const [stepId, calls] of callsByStep) {
      assert.deepEqual(calls.map((call) => call.actionOrdinal), expectedOrdinals(stepId));
    }
    assert.deepEqual(output.evidence_refs, state.calls.flatMap((call) =>
      call.child === "checkpoint_gpt_text_response" ? [`artifact:${call.productStepId}`]
        : call.child === "checkpoint_gpt_generated_image"
          ? ["artifact:image-original", "artifact:image-webp", "artifact:image-receipt"] : []));
  }
  assert.equal(new Set(state.calls.map((call) => call.sessionKey)).size, 1);
  assert.ok(state.calls.every((call) => call.sessionKey.includes(attemptId)));
  const firstPrompt = state.calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt;
  assert.equal(typeof firstPrompt, "string");
  if (actionId === "produce_article") {
    assert.equal(state.providerNames.length, 1);
    assert.match(firstPrompt as string, /解压并读取本轮唯一 ZIP 附件/u);
    assert.doesNotMatch(firstPrompt as string, new RegExp(state.providerNames[0]!, "u"),
      "Product prompt must describe the exact attachment set without owning the Provider filename");
    assert.match(firstPrompt as string, /原文\.md 与索引\.json/u);
    assert.match(firstPrompt as string, /public-knowledge-research-output\.v3/u);
    assert.match(firstPrompt as string, /本回合不得返回 article package/u);
    assert.doesNotMatch(firstPrompt as string, /ready_corpus_snapshot_hash|sha256:/u);
  } else {
    assert.match(firstPrompt as string, /读取且只读取本轮两个附件/u);
    assert.doesNotMatch(firstPrompt as string, new RegExp(state.providerNames.join("|"), "u"),
      "review prompts must not derive Provider filenames");
  }
  const files = state.calls.find((call) => call.child === "submit_exact_gpt_turn_once")?.input.files;
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
  attemptId = "attempt-1",
) => {
  const state = createHarness(actionId, failureAt);
  const firstFailure = await runPlugin(
    plugin, seoTask(actionId), createContext(state, decision, failureAt, attemptId), state, recoverAfterFault,
  );
  const completed = assertHarness(state, actionId, recoverAfterFault, attemptId);
  return {
    calls: state.calls, completed, firstFailure,
    physicalSubmitDispatches: state.physicalSubmitDispatches,
    generatedImageUploadCalls: state.generatedImageUploadCalls,
  };
};

const exerciseBlockingFailure = async (
  plugin: ProductPlugin,
  failureAt: SeoFailure,
  message: string,
) => {
  const state = createHarness("produce_article", failureAt);
  let failure: unknown = null;
  try {
    await withFastHandoffs(state, () => plugin.execute(
      seoTask("produce_article"), createContext(state, "proceed", failureAt),
    ));
  } catch (error) {
    failure = error;
  }
  assert(failure, message);
  return Object.freeze({ calls: Object.freeze([...state.calls]), failure,
    physicalSubmitDispatches: state.physicalSubmitDispatches });
};

export const exerciseSeoAttachmentReconcileFailure = async (plugin: ProductPlugin) =>
  exerciseBlockingFailure(plugin, Object.freeze({
    child: "reconcile_gpt_attachment_set",
    code: "GPT_ATTACHMENT_UPLOAD_TIMEOUT",
    productStepId: "corpus_research",
  }), "attachment reconciliation failure must stop the Product flow");

export const exerciseSeoPromptWriteFailure = async (plugin: ProductPlugin) =>
  exerciseBlockingFailure(plugin, Object.freeze({
    child: "write_exact_gpt_prompt",
    code: "GPT_PROMPT_WRITE_UNCONFIRMED",
    productStepId: "corpus_research",
  }), "prompt write failure must stop the Product flow before draft reconciliation and submit");
