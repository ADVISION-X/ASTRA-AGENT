import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";

import type { ProductPlugin, ProductPluginOutput, WebsiteAgentTask,
  SharedExecutionContext } from "../../../src/mediator/product-plugin-contract.js";
import { createContext, withFastHandoffs } from
  "./public-knowledge-article-pipeline.test-runtime.js";
import { createHarness, seoTask, type SeoAction, type SeoFailure, type SeoHarness } from
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
): ProductPluginOutput => {
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
