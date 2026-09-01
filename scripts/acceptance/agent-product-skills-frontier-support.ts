import assert from "../audit/shared/governance-exam-assert.js";

import type { ProductPlugin } from "../../src/lib/local-runtime/production/plugin.js";
import {
  createContext,
  createHarness,
  seoTask,
  withFastHandoffs,
  type SeoFailure,
  type SeoHarness,
} from "./agent-product-skills-flow-support.js";

export const exerciseSeoFrontierResume = async (plugin: ProductPlugin) => {
  const failureAt: SeoFailure = {
    child: "select_exact_gpt_model_v2", code: "BROWSER_POSTCONDITION_FAILED",
    productStepId: "article_synthesis",
  };
  const state = createHarness("produce_article", failureAt);
  const taskInput = seoTask("produce_article");
  return withFastHandoffs(state, async () => {
    let firstFailure: unknown = null;
    try { await plugin.execute(taskInput, createContext(state, "proceed", failureAt, "attempt-1")); }
    catch (error) { firstFailure = error; }
    assert(firstFailure, "the first attempt must preserve the model-selection failure");
    assert.equal(state.frontierRef === null, false, "research persist must atomically bind the frontier");
    const firstAttemptCalls = state.calls.length;
    const researchSubmitsBeforeResume = state.calls.filter((call) =>
      call.productStepId === "corpus_research" && call.child === "submit_exact_gpt_turn_once").length;
    state.completed = null;
    await plugin.execute(taskInput, createContext(state, "proceed", undefined, "attempt-2"));
    const resumeCalls = state.calls.slice(firstAttemptCalls);
    assert.equal(resumeCalls[0]?.actionOrdinal, 17);
    assert.equal(resumeCalls[0]?.productStepId, "article_synthesis");
    assert.equal(resumeCalls.some((call) => call.productStepId === "corpus_research"), false);
    assert.equal(state.calls.filter((call) => call.productStepId === "corpus_research"
      && call.child === "submit_exact_gpt_turn_once").length, researchSubmitsBeforeResume);
    assert.equal(state.physicalSubmitDispatches, 3);
    const completed = (state as SeoHarness).completed;
    assert(completed?.generated_image);
    return { firstFailure, resumeCalls, completed };
  });
};

export const exerciseSeoArticleFrontierResume = async (plugin: ProductPlugin) => {
  const failureAt: SeoFailure = {
    child: "select_exact_gpt_model_v2", code: "BROWSER_POSTCONDITION_FAILED",
    productStepId: "article_image_generation",
  };
  const state = createHarness("produce_article", failureAt);
  const taskInput = seoTask("produce_article");
  return withFastHandoffs(state, async () => {
    let firstFailure: unknown = null;
    try { await plugin.execute(taskInput, createContext(state, "proceed", failureAt, "attempt-1")); }
    catch (error) { firstFailure = error; }
    assert(firstFailure, "the first attempt must fail after the article checkpoint");
    assert.equal(state.currentCheckpoint?.checkpointKind, "text");
    assert.notEqual(state.currentCheckpoint?.artifactRef, state.frontierOriginCheckpoint?.artifactRef);
    const firstAttemptCalls = state.calls.length;
    await plugin.execute(taskInput, createContext(state, "proceed", undefined, "attempt-2"));
    const resumeCalls = state.calls.slice(firstAttemptCalls);
    assert.equal(resumeCalls[0]?.actionOrdinal, 32);
    assert.equal(resumeCalls.every((call) => call.productStepId === "article_image_generation"), true);
    assert.equal(resumeCalls.some((call) => call.productStepId === "corpus_research"
      || call.productStepId === "article_synthesis"), false);
    assert.equal(state.physicalSubmitDispatches, 3);
    assert(state.completed?.generated_image);
    return { firstFailure, resumeCalls, completed: state.completed };
  });
};

export const exerciseSeoConfirmedImageSubmitResume = async (
  plugin: ProductPlugin,
  readbackCode = "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
) => {
  const failureAt: SeoFailure = {
    child: "reconcile_gpt_turn_submission", code: readbackCode,
    productStepId: "article_image_generation",
  };
  const state = createHarness("produce_article", failureAt);
  const taskInput = seoTask("produce_article");
  return withFastHandoffs(state, async () => {
    let firstFailure: unknown = null;
    try { await plugin.execute(taskInput, createContext(state, "proceed", failureAt, "attempt-1")); }
    catch (error) { firstFailure = error; }
    assert(firstFailure, "the first attempt must fail after the image submit was confirmed");
    const firstAttemptCalls = state.calls.length;
    const submitsBeforeResume = state.physicalSubmitDispatches;
    await plugin.execute(taskInput, createContext(state, "proceed", undefined, "attempt-2"));
    const resumeCalls = state.calls.slice(firstAttemptCalls);
    const forbidden = new Set([
      "open_gpt_execution_profile", "open_gpt_model_selector_v2", "select_exact_gpt_model_v2",
      "ensure_exact_gpt_reasoning_tier", "close_gpt_execution_profile", "write_exact_gpt_prompt",
      "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
    ]);
    assert.equal(resumeCalls.some((call) => forbidden.has(call.child)), false);
    assert.equal(resumeCalls.some((call) => call.productStepId !== "article_image_generation"), false);
    assert.equal(resumeCalls.find((call) => call.actionOrdinal >= 35)?.actionOrdinal, 43);
    assert.equal(state.physicalSubmitDispatches, submitsBeforeResume);
    assert(state.completed?.generated_image);
    return { firstFailure, resumeCalls, completed: state.completed };
  });
};

export const exerciseSeoImageFrontierResume = async (plugin: ProductPlugin) => {
  const state = createHarness("produce_article");
  state.completionFailuresRemaining = 1;
  const taskInput = seoTask("produce_article");
  return withFastHandoffs(state, async () => {
    let firstFailure: unknown = null;
    try { await plugin.execute(taskInput, createContext(state, "proceed", undefined, "attempt-1")); }
    catch (error) { firstFailure = error; }
    assert(firstFailure, "the first attempt must fail only after the image frontier advanced");
    assert.equal(state.currentCheckpoint?.checkpointKind, "generated_image");
    const firstAttemptCalls = state.calls.length;
    const submitsBeforeResume = state.physicalSubmitDispatches;
    await plugin.execute(taskInput, createContext(state, "proceed", undefined, "attempt-2"));
    const resumeCalls = state.calls.slice(firstAttemptCalls);
    assert.deepEqual(resumeCalls, []);
    assert.equal(state.physicalSubmitDispatches, submitsBeforeResume);
    assert(state.completed?.generated_image);
    return { firstFailure, resumeCalls, completed: state.completed };
  });
};
