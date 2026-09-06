import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { typedExecutionFailure } from "../../../src/lib/execution-failure.js";
import { postSubmitReadbackReceipt } from "../../../src/mediator/product-plugin-contract.js";
import { productionRoutePolicy } from "../../../src/lib/local-runtime/production/route-policy.js";
import { parsePublicKnowledgeArticle, parsePublicKnowledgeResearch } from "../../../src/plugins/public-knowledge-article-pipeline/result-contract.js";
import {
  exerciseSeoAttachmentReconcileFailure,
  exerciseSeoFlow,
  exerciseSeoPromptWriteFailure,
} from "./public-knowledge-article-pipeline-flow.test-runtime.js";
import { articleOutput, researchOutput } from
  "./public-knowledge-article-pipeline-output-fixtures.js";
import {
  exerciseSeoArticleFrontierResume,
  exerciseSeoConfirmedImageSubmitResume,
  exerciseSeoFrontierResume,
  exerciseSeoImageFrontierResume,
} from "./public-knowledge-article-pipeline-frontier.test-runtime.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "public-knowledge-article-pipeline");
assert(plugin);
const produceRoute = productionRoutePolicy("public_knowledge_article_pipeline", "produce_article");
const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const profile = [
  "open_gpt_execution_profile", "open_gpt_model_selector_v2", "select_exact_gpt_model_v2",
  "open_gpt_execution_profile", "ensure_gpt_reasoning_requirement", "close_gpt_execution_profile",
] as const;
const attachments = [
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
] as const;
const textTurn = [
  "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
  "reconcile_gpt_turn_submission", "wait_for_stable_gpt_text", "checkpoint_gpt_text_response",
] as const;
const initialText = ["prepare_clean_gpt_chat", ...profile, ...attachments, ...textTurn] as const;
const continuationText = [
  "acquire_gpt_continuation_lane", "focus_exact_gpt_conversation", "verify_gpt_conversation_identity",
  ...profile, ...textTurn, "advance_gpt_continuation_lane",
] as const;
const continuationImage = [
  "acquire_gpt_continuation_lane", "focus_exact_gpt_conversation", "verify_gpt_conversation_identity",
  ...profile, "write_exact_gpt_prompt", "reconcile_gpt_draft", "submit_exact_gpt_turn_once",
  "reconcile_gpt_turn_submission", "wait_for_stable_gpt_image", "checkpoint_gpt_generated_image",
  "advance_gpt_continuation_lane",
] as const;

assert.equal(plugin.pluginVersion, 20);
const source = readFileSync("src/plugins/public-knowledge-article-pipeline/index.ts", "utf8");
assert.doesNotMatch(source, /PRODUCT_FLOW_NOT_IMPLEMENTED:|throw new Error/u);
assert.match(source, /corpus_research/u);
assert.match(source, /article_synthesis/u);
assert.match(source, /article_image_generation/u);
assert.doesNotMatch(
  readFileSync("src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts", "utf8"),
  /return input\.recoveryProvider\.provider_page_url/u,
  "recovery must execute the exact reconcile call so Runtime reads the durable locator artifact",
);
assert.equal(parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"), topic_manifest: { primary_question: "incomplete" },
}), produceRoute).schema_version, "public-knowledge-research-output.v3");
assert.equal(parsePublicKnowledgeArticle(JSON.stringify({
  ...articleOutput(), claim_coverage: [{ claim_id: "CL1", status: "addressed", reason_if_omitted: "must-be-null" }],
}), produceRoute).schema_version, "public-knowledge-article-output.v3");

const decline = await exerciseSeoFlow(plugin, "produce_article", "decline");
assert.deepEqual(decline.calls.map((call) => call.child), [...initialText, "persist_gpt_continuation"]);
assert.equal(decline.calls.some((call) => call.productStepId === "article_synthesis"), false);

const proceed = await exerciseSeoFlow(plugin, "produce_article", "proceed");
assert.deepEqual(proceed.calls.map((call) => call.child), [
  ...initialText, "persist_gpt_continuation", ...continuationText, ...continuationImage,
]);
const reasoningProfileCalls = proceed.calls.filter(
  (call) => call.child === "ensure_gpt_reasoning_requirement",
);
assert.equal(reasoningProfileCalls.length, 3);
for (const call of reasoningProfileCalls) {
  assert.equal(call.input.profile.profileRef,
    "public-knowledge-article-pipeline:gpt-5.6-sol-high");
  assert.equal(call.input.profile.modelDisplayName, "GPT-5.6 Sol");
  assert.deepEqual(call.input.profile.reasoningRequirement, {
    selectionPolicy: "exact",
    requestedTier: "high",
  });
}
assert.deepEqual([...new Set(proceed.calls.map((call) => call.productStepId))], [
  "corpus_research", "article_synthesis", "article_image_generation",
]);
assert.equal(proceed.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1);
assert.equal(proceed.calls.filter((call) => call.child === "submit_exact_gpt_turn_once").length, 3);
const prompts = proceed.calls.filter((call) => call.child === "write_exact_gpt_prompt")
  .map((call) => String(call.input.prompt));
assert.match(prompts[0]!, /public-knowledge-research-output\.v3/u);
assert.match(prompts[1]!, /public-knowledge-article-output\.v3/u);
assert.match(prompts[2]!, /一张横向文章主图/u);
assert.doesNotMatch(prompts[2]!, /无文字|无印章|不冒充/u);
const persistProvider = proceed.calls.find((call) => call.child === "persist_gpt_continuation")?.input.provider;
assert(persistProvider);
const verifies = proceed.calls.filter((call) => call.child === "verify_gpt_conversation_identity");
const advances = proceed.calls.filter((call) => call.child === "advance_gpt_continuation_lane");
assert.equal(persistProvider.prior_prompt_hash, hashText(prompts[0]!));
assert.equal(verifies[0]?.input.expectedPromptHash, hashText(prompts[0]!));
assert.equal(advances[0]?.input.provider.prior_prompt_hash, hashText(prompts[1]!));
assert.equal(verifies[1]?.input.expectedPromptHash, hashText(prompts[1]!));
assert.equal(advances[1]?.input.provider.prior_prompt_hash, hashText(prompts[2]!));
assert.ok((proceed.completed.payload as Readonly<Record<string, unknown>>).image);
assert.equal(proceed.generatedImageUploadCalls, 1);

const attachmentBlocked = await exerciseSeoAttachmentReconcileFailure(plugin);
assert.equal(typedExecutionFailure(attachmentBlocked.failure)?.code, "GPT_ATTACHMENT_UPLOAD_TIMEOUT");
assert.equal(attachmentBlocked.calls.at(-1)?.child, "reconcile_gpt_attachment_set");
assert.equal(attachmentBlocked.calls.some((call) => call.child === "write_exact_gpt_prompt"), false,
  "Prompt input must not start until the exact attachment set is ready");
assert.equal(attachmentBlocked.calls.some((call) => call.child === "submit_exact_gpt_turn_once"), false,
  "submit must not start when attachment readiness fails");
assert.equal(attachmentBlocked.physicalSubmitDispatches, 0);

const promptBlocked = await exerciseSeoPromptWriteFailure(plugin);
assert.equal(typedExecutionFailure(promptBlocked.failure)?.code, "GPT_PROMPT_WRITE_UNCONFIRMED");
assert.equal(promptBlocked.calls.at(-1)?.child, "write_exact_gpt_prompt");
assert.equal(promptBlocked.calls.some((call) => call.child === "reconcile_gpt_draft"), false,
  "draft reconciliation must not start after exact Prompt readback fails");
assert.equal(promptBlocked.calls.some((call) => call.child === "submit_exact_gpt_turn_once"), false,
  "submit must not start after exact Prompt readback fails");
assert.equal(promptBlocked.physicalSubmitDispatches, 0);

const directSubmitRecovered = await exerciseSeoFlow(plugin, "produce_article", "proceed", {
  child: "submit_exact_gpt_turn_once",
  code: "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED",
  productStepId: "corpus_research",
  confirmedSubmit: true,
}, true);
assert.equal(postSubmitReadbackReceipt(directSubmitRecovered.firstFailure)?.causeCode,
  "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED");
const firstResearchSubmit = directSubmitRecovered.calls.findIndex((call) =>
  call.productStepId === "corpus_research" && call.child === "submit_exact_gpt_turn_once");
assert.equal(directSubmitRecovered.calls[firstResearchSubmit + 1]?.child,
  "submit_exact_gpt_turn_once",
  "the recovered invocation must settle the same confirmed submit evidence without another physical dispatch");
assert.equal(directSubmitRecovered.calls[firstResearchSubmit + 2]?.child,
  "reconcile_gpt_turn_submission",
  "the settled confirmed submit must proceed directly to its locator reconciliation");
assert.equal(directSubmitRecovered.calls.filter((call) => call.productStepId === "corpus_research"
  && call.child === "submit_exact_gpt_turn_once").length, 2,
  "the same accepted attempt may invoke the submit Child once more only for WAL-backed readback settlement");
assert.equal(directSubmitRecovered.physicalSubmitDispatches, 3,
  "the recovered research turn plus article and image turns must still dispatch exactly three submits");

const articleSubmitRecovered = await exerciseSeoFlow(plugin, "produce_article", "proceed", {
  child: "submit_exact_gpt_turn_once",
  code: "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED",
  productStepId: "article_synthesis",
  confirmedSubmit: true,
}, true);
assert.equal(postSubmitReadbackReceipt(articleSubmitRecovered.firstFailure)?.causeCode,
  "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED");
assert.equal(articleSubmitRecovered.calls.filter((call) => call.productStepId === "article_synthesis"
  && call.child === "submit_exact_gpt_turn_once").length, 2,
  "article recovery must settle the same confirmed submit without a second physical dispatch");
assert.equal(articleSubmitRecovered.physicalSubmitDispatches, 3,
  "research, recovered article and image must still dispatch exactly once each");
assert.equal(articleSubmitRecovered.generatedImageUploadCalls, 1,
  "the recovered article turn must continue through image generation and Website upload assembly");

const imageSubmitRecovered = await exerciseSeoFlow(plugin, "produce_article", "proceed", {
  child: "submit_exact_gpt_turn_once",
  code: "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED",
  productStepId: "article_image_generation",
  confirmedSubmit: true,
}, true);
assert.equal(postSubmitReadbackReceipt(imageSubmitRecovered.firstFailure)?.causeCode,
  "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED");
assert.equal(imageSubmitRecovered.calls.filter((call) => call.productStepId === "article_image_generation"
  && call.child === "submit_exact_gpt_turn_once").length, 2,
  "image recovery must also settle the same confirmed submit without a second physical dispatch");
assert.equal(imageSubmitRecovered.physicalSubmitDispatches, 3,
  "research, article and image must still dispatch exactly once each after image recovery");
assert.equal(imageSubmitRecovered.generatedImageUploadCalls, 1,
  "the recovered image turn must continue through checkpoint and Website upload assembly");

await assert.rejects(
  () => exerciseSeoFlow(plugin, "produce_article", "proceed", {
    child: "submit_exact_gpt_turn_once",
    code: "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED",
    productStepId: "corpus_research",
  }),
  (error: unknown) => typedExecutionFailure(error)?.code
    === "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED"
    && postSubmitReadbackReceipt(error) === null,
  "a submit failure without exact Browser CONFIRMED metadata must never enter post-submit recovery",
);

await assert.rejects(
  () => exerciseSeoFlow(plugin, "produce_article", "proceed", {
    child: "reconcile_gpt_turn_submission",
    code: "GPT_TURN_SUBMISSION_RECONCILIATION_PENDING",
    productStepId: "corpus_research",
  }),
  (error: unknown) => typedExecutionFailure(error)?.code
    === "POST_SUBMIT_READBACK_FAULT:GPT_TURN_SUBMISSION_RECONCILIATION_PENDING"
    && postSubmitReadbackReceipt(error)?.causeCode === "GPT_TURN_SUBMISSION_RECONCILIATION_PENDING",
  "a pending locator must preserve the same accepted attempt as post-submit readback work",
);

const recovered = await exerciseSeoFlow(plugin, "produce_article", "proceed", {
  child: "checkpoint_gpt_text_response", code: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
  productStepId: "article_synthesis",
}, true);
assert.equal(postSubmitReadbackReceipt(recovered.firstFailure)?.causeCode,
  "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE");
assert.equal(recovered.physicalSubmitDispatches, 3);
assert.deepEqual(recovered.acquiredLaneVersions, [1, 2, 3]);

const researchFrontier = await exerciseSeoFrontierResume(plugin);
assert.equal(typedExecutionFailure(researchFrontier.firstFailure)?.code, "BROWSER_POSTCONDITION_FAILED");
assert.equal(researchFrontier.resumeCalls.some((call) => call.productStepId === "corpus_research"), false);
const articleFrontier = await exerciseSeoArticleFrontierResume(plugin);
assert.equal(typedExecutionFailure(articleFrontier.firstFailure)?.code, "BROWSER_POSTCONDITION_FAILED");
assert.equal(articleFrontier.resumeCalls.some((call) => call.productStepId === "article_synthesis"), false);

for (const readbackCode of [
  "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", "BROWSER_TARGET_INVALID", "BROWSER_DOCUMENT_INVALID",
  "BROWSER_DOM_CANDIDATE_MISSING", "GPT_RESPONSE_STABILITY_TIMEOUT", "GPT_RESPONSE_WAIT_ABORTED",
  "GPT_RATE_LIMIT_ACTIVE",
]) {
  const imageResume = await exerciseSeoConfirmedImageSubmitResume(plugin, readbackCode);
  assert.equal(typedExecutionFailure(imageResume.firstFailure)?.code,
    `POST_SUBMIT_READBACK_FAULT:${readbackCode}`);
  assert.equal(imageResume.resumeCalls.filter(
    (call) => call.child === "submit_exact_gpt_turn_once",
  ).length, 1, "same-attempt recovery must settle the existing submit Child without a second dispatch");
}
const imageFrontier = await exerciseSeoImageFrontierResume(plugin);
assert.equal(typedExecutionFailure(imageFrontier.firstFailure)?.code, "WEBSITE_COMPLETION_TEST_FAULT");
assert.deepEqual(imageFrontier.resumeCalls, []);

await assert.rejects(
  () => exerciseSeoFlow(plugin, "accuracy_challenge", "proceed", {
    child: "wait_for_stable_gpt_text", code: "GPT_PROVIDER_TERMINAL_DECLINED",
  }),
  (error: unknown) => typedExecutionFailure(error)?.code === "GPT_PROVIDER_TERMINAL_DECLINED"
    && postSubmitReadbackReceipt(error) === null,
);
for (const action of ["accuracy_challenge", "quality_reflection"] as const) {
  const review = await exerciseSeoFlow(plugin, action);
  assert.deepEqual(review.calls.map((call) => call.child), initialText);
  assert.equal(review.calls.some((call) => call.child.includes("continuation")), false);
}
process.stdout.write("[ACCEPTANCE][public-knowledge-article-pipeline] PASS\n");
