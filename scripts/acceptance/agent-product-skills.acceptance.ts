import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  agentPluginCapabilityManifest,
  productionPluginCatalog,
  resolveProductionPlugin,
} from "../../src/lib/local-runtime/production/catalog.js";
import { ProductionProductIdSchema, hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";
import {
  postSubmitReadbackReceipt,
  typedExecutionFailure,
} from "../../src/lib/typed-failure.js";
import { productionRoutePolicies } from "../../src/lib/local-runtime/production/route-policy.js";
import { parsePublicKnowledgeArticle, parsePublicKnowledgeResearch } from "../../src/plugins/public-knowledge-article-pipeline/result-contract.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";
import {
  articleOutput,
  exerciseSeoFlow,
  researchOutput,
} from "./agent-product-skills-flow-support.js";
import {
  exerciseSeoArticleFrontierResume,
  exerciseSeoConfirmedImageSubmitResume,
  exerciseSeoFrontierResume,
  exerciseSeoImageFrontierResume,
} from "./agent-product-skills-frontier-support.js";
import { exerciseProductOwnedFlow } from "./agent-product-owned-flow-support.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const hashText = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const PROFILE_SEQUENCE = [
  "open_gpt_execution_profile",
  "open_gpt_model_selector_v2",
  "select_exact_gpt_model_v2",
  "ensure_exact_gpt_reasoning_tier",
  "close_gpt_execution_profile",
] as const;
const ATTACHMENT_SEQUENCE = [
  "open_gpt_attachment_control",
  "attach_approved_gpt_files_once",
  "reconcile_gpt_attachment_set",
] as const;
const TEXT_TURN_SEQUENCE = [
  "write_exact_gpt_prompt",
  "reconcile_gpt_draft",
  "submit_exact_gpt_turn_once",
  "reconcile_gpt_turn_submission",
  "wait_for_stable_gpt_text",
  "checkpoint_gpt_text_response",
] as const;
const INITIAL_TEXT_SEQUENCE = [
  "prepare_clean_gpt_chat",
  ...PROFILE_SEQUENCE,
  ...ATTACHMENT_SEQUENCE,
  ...TEXT_TURN_SEQUENCE,
] as const;
const CONTINUATION_TEXT_SEQUENCE = [
  "acquire_gpt_continuation_lane",
  "focus_exact_gpt_conversation",
  "verify_gpt_conversation_identity",
  ...PROFILE_SEQUENCE,
  ...TEXT_TURN_SEQUENCE,
  "advance_gpt_continuation_lane",
] as const;
const PRODUCT_CONTINUATION_TEXT_SEQUENCE = [
  "acquire_gpt_continuation_lane",
  "focus_exact_gpt_conversation",
  "verify_gpt_conversation_identity",
  ...PROFILE_SEQUENCE,
  ...ATTACHMENT_SEQUENCE,
  ...TEXT_TURN_SEQUENCE,
  "advance_gpt_continuation_lane",
] as const;
const CONTINUATION_IMAGE_SEQUENCE = [
  "acquire_gpt_continuation_lane",
  "focus_exact_gpt_conversation",
  "verify_gpt_conversation_identity",
  ...PROFILE_SEQUENCE,
  "write_exact_gpt_prompt",
  "reconcile_gpt_draft",
  "submit_exact_gpt_turn_once",
  "reconcile_gpt_turn_submission",
  "wait_for_stable_gpt_image",
  "checkpoint_gpt_generated_image",
  "advance_gpt_continuation_lane",
] as const;


const inspectSkill = (productIds: readonly string[], text: string): readonly string[] => {
  const findings: string[] = [];
  const substantiveLines = text.split("\n").map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (text !== text.normalize("NFC") || text.includes("\r")) findings.push("skill-text-not-canonical");
  if (Buffer.byteLength(text, "utf8") < 1_400 || substantiveLines.length < 8) findings.push("skill-content-shell");
  for (const productId of productIds) if (!text.includes(productId)) findings.push(`skill-product-identity-missing:${productId}`);
  if (!text.includes("复核")) findings.push("skill-review-policy-missing");
  for (const forbidden of [/\bBrowser\b/u, /\brunTurn\b/u, /\bstep_id\b/u, /\bsame_conversation_as\b/u]) {
    if (forbidden.test(text)) findings.push(`skill-execution-truth-leak:${forbidden.source}`);
  }
  return findings;
};

assert.equal(productionPluginCatalog.length, 12);
assert.equal(productionRoutePolicies.length, 39);
assert.equal(agentPluginCapabilityManifest.plugins.length, 12);
assert.equal(hashCanonical(agentPluginCapabilityManifest.plugins), agentPluginCapabilityManifest.catalog_hash);
assert.equal(existsSync(resolve(ROOT, "src/plugins/product-gpt-call.ts")), false);
assert.equal(existsSync(resolve(ROOT, "src/lib/local-runtime/production/production-gpt-executor.ts")), false);
assert.equal(existsSync(resolve(ROOT, "src/lib/local-runtime/production/production-gpt-turn-flow.ts")), false);
assert.doesNotMatch(
  readFileSync(resolve(ROOT, "src/plugins/public-knowledge-article-pipeline/seo-gpt-calls.ts"), "utf8"),
  /return input\.recoveryProvider\.provider_page_url/u,
  "recovery must execute the exact reconcile call so Runtime reads the durable locator artifact",
);
assert.equal(parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"), topic_manifest: { primary_question: "incomplete" },
})).schema_version, "public-knowledge-research-output.v3",
"transport parsing must preserve a URL/hash-authenticated AI object without policing nested shape");
assert.equal(parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"), citations: [{ citation_id: "bad", book_id: "book", locator: "one" }],
})).schema_version, "public-knowledge-research-output.v3");
assert.equal(parsePublicKnowledgeArticle(JSON.stringify({
  ...articleOutput(), claim_coverage: [{ claim_id: "CL1", status: "addressed", reason_if_omitted: "must-be-null" }],
})).schema_version, "public-knowledge-article-output.v3");

const routeKeys = new Set<string>();
const productIds = new Set<string>();
const skillHashes = new Set<string>();
for (const plugin of productionPluginCatalog) {
  const directory = resolve(ROOT, `src/plugins/${plugin.pluginId}`);
  const source = readFileSync(resolve(directory, "index.ts"), "utf8");
  const skillText = readFileSync(resolve(directory, "SKILL.md"), "utf8");
  assert.equal(readdirSync(directory).some((name) => name === "gpt-flow.ts"), false,
    `${plugin.pluginId} must not contain a fabricated shared GPT flow copy`);
  assert.doesNotMatch(source, /runTurn|executeProductGptCall/u);
  assert.equal(existsSync(resolve(directory, "result-contract.ts")), true);
  assert.equal(readdirSync(dirname(resolve(directory, "SKILL.md")))
    .filter((name) => name.toLowerCase() === "skill.md").length, 1);
  const ownedProductIds = [...new Set(plugin.accepts.map((entry) => entry.productId))];
  assert.deepEqual(inspectSkill(ownedProductIds, skillText), [], `${plugin.pluginId} Skill contract drifted`);
  const skillHash = `sha256:${createHash("sha256").update(skillText.normalize("NFC")).digest("hex")}`;
  assert.equal(plugin.skillHash, skillHash);
  assert(!skillHashes.has(skillHash), `${plugin.pluginId} duplicates another Product Skill`);
  skillHashes.add(skillHash);
  for (const route of plugin.accepts) {
    const key = `${route.productId}\u0000${route.actionId}`;
    assert(!routeKeys.has(key), `duplicate Product route ${key}`);
    routeKeys.add(key);
    productIds.add(route.productId);
  }
  const firstRoute = plugin.accepts[0]!;
  assert.equal(resolveProductionPlugin(firstRoute.productId, firstRoute.actionId).plugin, plugin);
  if (plugin.pluginId === "public-knowledge-article-pipeline") {
    assert.equal(plugin.pluginVersion, 16);
    assert.doesNotMatch(source, /PRODUCT_FLOW_NOT_IMPLEMENTED:/u);
    assert.doesNotMatch(source, /throw new Error/u,
      "SEO Product-owned failures must remain typed through the runtime boundary");
    assert.match(source, /corpus_research/u);
    assert.match(source, /article_synthesis/u);
    assert.match(source, /article_image_generation/u);
    const decline = await exerciseSeoFlow(plugin, "produce_article", "decline");
    assert.deepEqual(decline.calls.map((call) => call.child), [
      ...INITIAL_TEXT_SEQUENCE,
      "persist_gpt_continuation",
    ]);
    assert.equal(decline.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1);
    assert.equal(decline.calls.some((call) => call.productStepId === "article_synthesis"), false);
    const proceed = await exerciseSeoFlow(plugin, "produce_article", "proceed");
    assert.deepEqual(proceed.calls.map((call) => call.child), [
      ...INITIAL_TEXT_SEQUENCE,
      "persist_gpt_continuation",
      ...CONTINUATION_TEXT_SEQUENCE,
      ...CONTINUATION_IMAGE_SEQUENCE,
    ]);
    assert.deepEqual([...new Set(proceed.calls.map((call) => call.productStepId))], [
      "corpus_research", "article_synthesis", "article_image_generation",
    ]);
    assert.equal(proceed.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1);
    assert.equal(proceed.calls.filter((call) => call.child === "submit_exact_gpt_turn_once").length, 3);
    assert.equal(proceed.calls.filter((call) => call.child === "advance_gpt_continuation_lane").length, 2);
    const prompts = proceed.calls.filter((call) => call.child === "write_exact_gpt_prompt")
      .map((call) => String(call.input.prompt));
    assert.match(prompts[0]!, /public-knowledge-research-output\.v3/u);
    assert.match(prompts[1]!, /public-knowledge-article-output\.v3/u);
    assert.match(prompts[2]!, /一张横向文章主图/u);
    assert.doesNotMatch(prompts[2]!, /无文字|无印章|不冒充/u);
    const persistProvider = proceed.calls.find((call) => call.child === "persist_gpt_continuation")
      ?.input.provider as Readonly<Record<string, unknown>>;
    const continuationVerifies = proceed.calls.filter((call) => call.child === "verify_gpt_conversation_identity");
    const continuationAdvances = proceed.calls.filter((call) => call.child === "advance_gpt_continuation_lane");
    assert.equal(persistProvider.prior_prompt_hash, hashText(prompts[0]!));
    assert.equal(continuationVerifies[0]?.input.expectedPromptHash, hashText(prompts[0]!));
    assert.equal((continuationAdvances[0]?.input.provider as Readonly<Record<string, unknown>>).prior_prompt_hash, hashText(prompts[1]!));
    assert.equal(continuationVerifies[1]?.input.expectedPromptHash, hashText(prompts[1]!));
    assert.equal((continuationAdvances[1]?.input.provider as Readonly<Record<string, unknown>>).prior_prompt_hash, hashText(prompts[2]!));
    assert.ok(proceed.completed.generated_image);
    const recovered = await exerciseSeoFlow(
      plugin, "produce_article", "proceed",
      { child: "checkpoint_gpt_text_response", code: "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE", productStepId: "article_synthesis" },
      true,
    );
    assert.equal(
      postSubmitReadbackReceipt(recovered.firstFailure)?.causeCode,
      "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
      "a transient Browser channel loss must release and retain the same attempt",
    );
    assert.equal(recovered.physicalSubmitDispatches, 3,
      "restart must not physically dispatch research or article submit again");
    assert.deepEqual(recovered.acquiredLaneVersions, [1, 2, 3],
      "released article lane must be physically reacquired before advance");
    assert.ok(recovered.completed.generated_image);
    const frontierResume = await exerciseSeoFrontierResume(plugin);
    assert.equal(
      typedExecutionFailure(frontierResume.firstFailure)?.code,
      "BROWSER_POSTCONDITION_FAILED",
      "the original article model-selection failure must remain truthful",
    );
    assert.equal(frontierResume.resumeCalls.some((call) => call.child === "attach_approved_gpt_files_once"), false);
    assert.equal(frontierResume.resumeCalls.some((call) => call.child === "write_exact_gpt_prompt"
      && call.productStepId === "corpus_research"), false);
    const articleFrontierResume = await exerciseSeoArticleFrontierResume(plugin);
    assert.equal(
      typedExecutionFailure(articleFrontierResume.firstFailure)?.code,
      "BROWSER_POSTCONDITION_FAILED",
      "the image-step model-selection failure must remain truthful after article checkpoint",
    );
    assert.equal(articleFrontierResume.resumeCalls.some((call) =>
      call.productStepId === "article_synthesis"), false);
    for (const readbackCode of [
      "BROWSER_EXTENSION_CHANNEL_UNAVAILABLE",
      "BROWSER_TARGET_INVALID",
      "BROWSER_DOCUMENT_INVALID",
      "BROWSER_DOM_CANDIDATE_MISSING",
      "GPT_RESPONSE_STABILITY_TIMEOUT",
      "GPT_RESPONSE_WAIT_ABORTED",
      "GPT_RATE_LIMIT_ACTIVE",
    ]) {
      const confirmedImageSubmitResume = await exerciseSeoConfirmedImageSubmitResume(plugin, readbackCode);
      assert.equal(
        typedExecutionFailure(confirmedImageSubmitResume.firstFailure)?.code,
        `POST_SUBMIT_READBACK_FAULT:${readbackCode}`,
        "the original post-submit readback failure must remain truthful",
      );
      assert.equal(confirmedImageSubmitResume.resumeCalls.some((call) =>
        call.child === "submit_exact_gpt_turn_once"), false);
    }
    const imageFrontierResume = await exerciseSeoImageFrontierResume(plugin);
    assert.equal(
      typedExecutionFailure(imageFrontierResume.firstFailure)?.code,
      "WEBSITE_COMPLETION_TEST_FAULT",
      "the post-image receiver fault must not erase the image frontier",
    );
    assert.equal(imageFrontierResume.resumeCalls.length, 0);
    await assert.rejects(
      () => exerciseSeoFlow(plugin, "accuracy_challenge", "proceed", {
        child: "checkpoint_gpt_text_response", code: "GPT_CHECKPOINT_SOFTWARE_FAULT",
      }),
      (error: unknown) => typedExecutionFailure(error)?.code
          === "POST_SUBMIT_READBACK_FAULT:GPT_CHECKPOINT_SOFTWARE_FAULT"
        && postSubmitReadbackReceipt(error)?.causeCode === "GPT_CHECKPOINT_SOFTWARE_FAULT",
      "a post-submit checkpoint software fault must preserve the confirmed Provider effect",
    );
    await assert.rejects(
      () => exerciseSeoFlow(plugin, "accuracy_challenge", "proceed", {
        child: "wait_for_stable_gpt_text", code: "GPT_USER_TURN_HASH_MISMATCH",
      }),
      (error: unknown) => typedExecutionFailure(error)?.code
          === "POST_SUBMIT_READBACK_FAULT:GPT_USER_TURN_HASH_MISMATCH"
        && postSubmitReadbackReceipt(error)?.causeCode === "GPT_USER_TURN_HASH_MISMATCH",
      "a post-submit turn identity mismatch must preserve the confirmed Provider effect",
    );
    await assert.rejects(
      () => exerciseSeoFlow(plugin, "accuracy_challenge", "proceed", {
        child: "wait_for_stable_gpt_text", code: "GPT_PROVIDER_TERMINAL_DECLINED",
      }),
      (error: unknown) => typedExecutionFailure(error)?.code === "GPT_PROVIDER_TERMINAL_DECLINED"
        && postSubmitReadbackReceipt(error) === null,
      "an explicit Provider terminal negative must not enter same-attempt readback recovery",
    );
    for (const actionId of ["accuracy_challenge", "quality_reflection"] as const) {
      const review = await exerciseSeoFlow(plugin, actionId);
      assert.deepEqual(review.calls.map((call) => call.child), INITIAL_TEXT_SEQUENCE);
      assert.equal(review.calls.filter((call) => call.child === "submit_exact_gpt_turn_once").length, 1);
      assert.equal(review.calls.some((call) => call.child.includes("continuation")), false);
    }
  } else {
    const flowSource = readFileSync(resolve(directory, "flow.ts"), "utf8");
    assert.doesNotMatch(`${source}\n${flowSource}`, /PRODUCT_FLOW_NOT_IMPLEMENTED:/u);
    assert.match(source, /execute: executeOwnedFlow/u);
    assert.match(flowSource, /context\.gpt\.execute/u);
    assert.match(flowSource, /readCallFacts/u);
    assert.match(flowSource, /GPT-5\.6 Sol/u);
    assert.match(flowSource, /reasoningTier: "pro_standard"/u);
    assert.match(flowSource, /preservePostSubmitReadback/u);
    for (const accepted of plugin.accepts) {
      const route = productionRoutePolicies.find((candidate) =>
        candidate.product_id === accepted.productId && candidate.action_id === accepted.actionId);
      assert(route, `missing route policy for ${accepted.productId}:${accepted.actionId}`);
      const run = await exerciseProductOwnedFlow(plugin, route);
      const children = run.calls.map((call) => call.child);
      if (route.relation_kind === "review") {
        assert.deepEqual(children, INITIAL_TEXT_SEQUENCE);
        assert.equal(children.some((child) => child.includes("continuation")), false);
      } else if (route.relation_kind === "continuation") {
        assert.deepEqual(children, PRODUCT_CONTINUATION_TEXT_SEQUENCE);
        const acquire = run.calls.find((call) => call.child === "acquire_gpt_continuation_lane");
        assert.deepEqual(acquire?.input.continuationRef, run.task.continuation_ref);
      } else {
        const persists = [
          "bazi-ai-full-analysis", "bazi-chart-interpretation",
          "qimen-professional-answer", "hehun-ai-analysis",
        ].includes(plugin.pluginId);
        assert.deepEqual(children, persists
          ? [...INITIAL_TEXT_SEQUENCE, "persist_gpt_continuation"]
          : INITIAL_TEXT_SEQUENCE);
      }
    }
  }
}

assert.equal(routeKeys.size, 39);
assert.deepEqual([...productIds].sort(), [...ProductionProductIdSchema.options].sort());
process.stdout.write("[ACCEPTANCE][agent-product-skills] PASS\n");
emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V25",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:0", "forbidden:1", "forbidden:15", "forbidden:16", "forbidden:2", "forbidden:21", "forbidden:22", "forbidden:29", "forbidden:5", "summary"],
  locator: "acceptance:agent-production-runtime:product-flow-golden",
  observedValue: "12 product plugins and all 39 routes exercised; confirmed image submit survives Target Document DOM channel timeout wait-abort and rate-limit readback faults with zero repeated submit, while Provider terminal negative does not recover",
});
