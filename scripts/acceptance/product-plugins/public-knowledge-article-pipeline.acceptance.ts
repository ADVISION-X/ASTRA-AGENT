import { governanceAssert as assert } from "../../audit/shared/governance-exam-assert.js";
import { readFileSync } from "node:fs";

import { productionPluginCatalog } from "../../../src/mediator/product-plugin-catalog.js";
import { typedExecutionFailure } from "../../../src/lib/execution-failure.js";
import { productionRoutePolicy } from "../../../src/lib/local-runtime/production/route-policy.js";
import { browserProviderEffectIdentityHash } from
  "../../../src/lib/browser/exact-target/browser-command-postcondition.js";
import { hashCanonical } from "../../../src/mediator/product-plugin-contract.js";
import { GPT_CHILD_CAPABILITY_CONTRACTS } from "../../../src/capabilities/gpt/contract.js";
import { parsePublicKnowledgeArticle, parsePublicKnowledgeResearch, publicKnowledgeTurnContract } from "../../../src/plugins/public-knowledge-article-pipeline/result-contract.js";
import {
  exerciseSeoAttachmentReconcileFailure,
  exerciseSeoFlow,
  exerciseSeoPromptWriteFailure,
} from "./public-knowledge-article-pipeline-flow.test-runtime.js";
import { createContext } from "./public-knowledge-article-pipeline.test-runtime.js";
import { createHarness, seoTask } from
  "./public-knowledge-article-pipeline-fixture-state.js";
import { articleOutput, researchOutput } from
  "./public-knowledge-article-pipeline-output-fixtures.js";

const plugin = productionPluginCatalog.find((entry) => entry.pluginId === "public-knowledge-article-pipeline");
assert(plugin);
const produceRoute = productionRoutePolicy("public_knowledge_article_pipeline", "produce_article");

const profile = [
  "open_gpt_execution_profile", "open_gpt_model_selector_v2", "select_exact_gpt_model_v2",
  "open_gpt_execution_profile", "ensure_gpt_reasoning_requirement", "close_gpt_execution_profile",
] as const;
const attachments = [
  "open_gpt_attachment_control", "attach_approved_gpt_files_once", "reconcile_gpt_attachment_set",
] as const;
const textTurn = [
  "write_exact_gpt_prompt", "submit_exact_gpt_turn_once", "checkpoint_gpt_text_response",
] as const;
const initialText = ["prepare_clean_gpt_chat", ...profile, ...attachments, ...textTurn] as const;
const continuedText = [...profile, ...textTurn] as const;
const continuedImage = [...profile, "write_exact_gpt_prompt",
  "submit_exact_gpt_turn_once", "checkpoint_gpt_generated_image"] as const;

assert.equal(GPT_CHILD_CAPABILITY_CONTRACTS.attach_approved_gpt_files_once.replayPolicy,
  "target-local-per-generation", "attachment upload is attempt/current-Document preparation");
assert.equal(GPT_CHILD_CAPABILITY_CONTRACTS.submit_exact_gpt_turn_once.replayPolicy,
  "provider-effect-once", "only submit is a cross-attempt Provider effect");
const source = readFileSync("src/plugins/public-knowledge-article-pipeline/index.ts", "utf8");
const resultContractSource = readFileSync(
  "src/plugins/public-knowledge-article-pipeline/result-contract.ts", "utf8",
);
const turnContractSource = readFileSync(
  "src/plugins/public-knowledge-article-pipeline/seo-turn-contract.ts", "utf8",
);
assert.doesNotMatch(source, /PRODUCT_FLOW_NOT_IMPLEMENTED:|throw new Error/u);
assert.doesNotMatch(`${source}\n${resultContractSource}`, /_agent_reception|lossless-normalization|normalizeTurn|RESEARCH_STRING_ARRAY_PATHS/u,
  "AGENT must not reshape Provider output or append a second reception contract");
assert.match(source, /corpus_research/u);
assert.match(source, /article_synthesis/u);
assert.match(source, /article_image_generation/u);
const turnMarkerSource = turnContractSource.match(/export const turnMarker[\s\S]*?;\n/u)?.[0] ?? "";
assert.match(turnMarkerSource,
  /hashCanonical\(\{ job_id: task\.job_id, product_step_id: stepId \}\)/u,
  "the Product prompt remains stable while Browser identity adds attempt_id separately");
assert.doesNotMatch(turnMarkerSource, /attempt/iu,
  "attempt identity belongs to the Browser fence rather than the Product prompt marker");
{
  const identityState = createHarness("produce_article");
  const context = createContext(identityState, "proceed");
  const mismatchedContext = Object.freeze({
    ...context,
    gpt: Object.freeze({ ...context.gpt, jobId: "job-not-owned-by-this-task" }),
  });
  await assert.rejects(
    () => plugin.execute(seoTask("produce_article"), mismatchedContext),
    (error: unknown) => typedExecutionFailure(error)?.code === "SEO_GPT_JOB_IDENTITY_MISMATCH",
    "Product must fail closed before deriving Provider filenames from a mismatched GPT job identity",
  );
  assert.equal(identityState.calls.length, 0,
    "job identity mismatch must fail before any GPT Child is invoked");
}
assert.equal(parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"), topic_manifest: { primary_question: "incomplete" },
}), produceRoute).schema_version, "public-knowledge-research-output.v3");
const wrongTypeResearch = parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"),
  topic_manifest: { ...researchOutput("proceed").topic_manifest, secondary_cluster_ids: "one" },
}), produceRoute);
assert.equal((wrongTypeResearch.topic_manifest as Record<string, unknown>).secondary_cluster_ids, "one",
  "AGENT must preserve a Provider field-type error for the Website owner to judge");
assert.equal(parsePublicKnowledgeArticle(JSON.stringify({
  ...articleOutput(), claim_coverage: [{ claim_id: "CL1", status: "addressed", reason_if_omitted: "must-be-null" }],
}), produceRoute).schema_version, "public-knowledge-article-output.v3");

const decline = await exerciseSeoFlow(plugin, "produce_article", "decline");
assert.deepEqual(decline.calls.map((call) => call.child), initialText);
assert.equal(decline.calls.some((call) => call.productStepId === "article_synthesis"), false);

const proceed = await exerciseSeoFlow(plugin, "produce_article", "proceed");
assert.deepEqual(proceed.calls.map((call) => call.child), [
  ...initialText, ...continuedText, ...continuedImage,
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
assert.deepEqual(proceed.calls.filter((call) => call.child === "submit_exact_gpt_turn_once")
  .map((call) => call.input.files.length), [1, 0, 0]);
const prompts = proceed.calls.filter((call) => call.child === "write_exact_gpt_prompt")
  .map((call) => String(call.input.prompt));
const promptContract = (prompt: string) => prompt.split("\n")
  .find((line) => line.startsWith("当前回合唯一输出子合同："))
  ?.slice("当前回合唯一输出子合同：".length);
assert.equal(promptContract(prompts[0]!), JSON.stringify(publicKnowledgeTurnContract(produceRoute, "research")));
assert.equal(promptContract(prompts[1]!), JSON.stringify(publicKnowledgeTurnContract(produceRoute, "article")));
assert.match(prompts[0]!, /public-knowledge-research-output\.v3/u);
assert.match(prompts[1]!, /public-knowledge-article-output\.v3/u);
assert.match(prompts[0]!, /输出子合同只约束交付格式与字段关系，不限制你的选题、分析、推理、观点或证据解释/u);
assert.match(prompts[1]!, /输出子合同只约束交付格式与字段关系，不限制你的分析、推理、观点或证据解释/u);
assert.match(prompts[0]!, /"field_relations":\{"cluster_ids_unique_and_from_current_domain_archive":true/u);
assert.match(prompts[0]!, /"required_nonempty_when_proceed":\["topic_manifest\.primary_question"/u);
assert.match(prompts[0]!, /"claim_support":\{"boundary_claim_may_omit_supporting_citations":true/u);
assert.match(prompts[0]!, /"field_types":\{"string":\["schema_version","decision"/u);
assert.match(prompts[0]!, /"citation_token":\{"outer_brackets":"optional_single_pair"/u);
assert.match(prompts[1]!, /"article_markdown_format":\{"nonempty":true,"body_only":true,"repeat_title":false,"allowed_heading_levels":\[2,3\]/u);
assert.match(prompts[1]!, /"required_nonempty":\["title","editor_note","article_markdown","citations"\]/u);
assert.match(prompts[1]!, /"field_relations":\{"citation_identity_and_order_equal_research":true/u);
assert.match(prompts[1]!, /"citation_marker_token":\{"format":"\[citation_reference\]"/u);
for (const hidden of ["analysis_method", "reasoning_policy", "viewpoint_policy", "evidence_interpretation", "image_creative_policy", "forbidden_body_phrases"]) assert.doesNotMatch(`${prompts[0]}\n${prompts[1]}`, new RegExp(`"${hidden}"`, "u"));
assert.doesNotMatch(prompts.join("\n"), /# 公开知识文章生产|严格区分古籍原文|用简体中文一次讲清|不得宿命绝对化|不得重新选题/u,
  "Provider Prompt must not inject Product Skill analysis or expression policy");
assert.match(prompts[2]!, /一张横向文章主图/u);
assert.doesNotMatch(prompts[2]!, /无文字|无印章|不冒充/u);
assert.equal(proceed.calls.filter((call) => call.child === "prepare_clean_gpt_chat").length, 1);
assert.equal(proceed.calls.find((call) => call.child === "prepare_clean_gpt_chat")?.productStepId,
  "corpus_research");
assert.ok((proceed.completed.payload as Readonly<Record<string, unknown>>).image);
assert.deepEqual(Object.keys(proceed.completed.payload as Readonly<Record<string, unknown>>).sort(),
  ["article", "image", "research", "schema_version"],
  "the delivered package must contain only the Website canonical fields");
assert.equal(proceed.generatedImageUploadCalls, 1);

const nextAttempt = await exerciseSeoFlow(
  plugin, "produce_article", "proceed", undefined, false, "attempt-2",
);
const submits = proceed.calls.filter((call) => call.child === "submit_exact_gpt_turn_once");
const nextAttemptSubmits = nextAttempt.calls.filter((call) => call.child === "submit_exact_gpt_turn_once");
assert.equal(submits.length, 3);
assert.equal(nextAttemptSubmits.length, 3);
assert.deepEqual(nextAttemptSubmits.map((call) => call.input), submits.map((call) => call.input),
  "the complete submit input, including Prompt marker and attachment names, must be byte-stable across attempts");
for (const [index, call] of submits.entries()) {
  const nextCall = nextAttemptSubmits[index]!;
  const identity = (attemptId: string, revision: number, input: typeof call.input): `sha256:${string}` => {
    const requestHash = hashCanonical([revision, hashCanonical(input)]);
    return (
    browserProviderEffectIdentityHash({
    jobId: "job-produce_article",
    attemptId,
    resultRevision: revision,
    productStepId: call.productStepId,
    callId: call.callId,
    childCapabilityId: call.child,
    inputHash: requestHash,
    } as never, hashCanonical({ child: call.child, input })));
  };
  assert.equal(identity("attempt-1", 0, call.input), identity("attempt-2", 0, nextCall.input),
    `submit ${index + 1} must retain one Browser provider-effect identity across attempts`);
  assert.notEqual(identity("attempt-1", 0, call.input), identity("attempt-2", 1, nextCall.input),
    `submit ${index + 1} must receive a new identity only for a new result revision`);
}

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
assert.equal(promptBlocked.calls.some((call) => call.child === "submit_exact_gpt_turn_once"), false,
  "submit must not start after exact Prompt readback fails");
assert.equal(promptBlocked.physicalSubmitDispatches, 0);
assert.equal(promptBlocked.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1,
  "the old attempt must have performed its own attachment preparation before the pre-submit failure");
assert.equal(nextAttempt.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1,
  "a new attempt for the same job must upload the approved attachment again");

{
  const recovered = createHarness("produce_article");
  recovered.confirmedSubmitSteps = new Set([
    "corpus_research", "article_synthesis", "article_image_generation",
  ]);
  await plugin.execute(seoTask("produce_article"), createContext(recovered, "proceed"));
  assert.deepEqual(recovered.submitReadbackQueries.map((call) => call.productStepId), [
    "corpus_research", "article_synthesis", "article_image_generation",
  ]);
  assert.deepEqual(recovered.calls.map((call) => call.child), [
    "checkpoint_gpt_text_response", "checkpoint_gpt_text_response", "checkpoint_gpt_generated_image",
  ], "confirmed submit readback must skip fresh, profile, attachment, prompt and submit actions");
  assert.equal(recovered.physicalSubmitDispatches, 0);
  assert(recovered.completed, "zero-input confirmed readback must still assemble one Product result");
}

await assert.rejects(
  () => exerciseSeoFlow(plugin, "accuracy_challenge", "proceed", {
    child: "checkpoint_gpt_text_response", code: "GPT_PROVIDER_TERMINAL_DECLINED",
  }),
  (error: unknown) => typedExecutionFailure(error)?.code === "GPT_PROVIDER_TERMINAL_DECLINED",
);
for (const action of ["accuracy_challenge", "quality_reflection"] as const) {
  const review = await exerciseSeoFlow(plugin, action);
  assert.deepEqual(review.calls.map((call) => call.child), initialText);
  assert.equal(review.calls.some((call) => call.child.includes("continuation")), false);
}
process.stdout.write("[ACCEPTANCE][public-knowledge-article-pipeline] PASS\n");
