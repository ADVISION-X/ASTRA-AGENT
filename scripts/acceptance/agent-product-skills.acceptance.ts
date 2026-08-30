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
import { gptAttachmentProviderDisplayName } from "../../src/capabilities/gpt/index.js";
import { ProductionProductIdSchema, hashCanonical, type WebsiteAgentTask } from "../../src/lib/local-runtime/production/contracts.js";
import type { ProductPluginOutput, SharedExecutionContext } from "../../src/lib/local-runtime/production/plugin.js";
import {
  executionFailure,
  postSubmitReadbackReceipt,
  typedExecutionFailure,
} from "../../src/lib/typed-failure.js";
import { productionRoutePolicies } from "../../src/lib/local-runtime/production/route-policy.js";
import { parsePublicKnowledgeArticle, parsePublicKnowledgeResearch } from "../../src/plugins/public-knowledge-article-pipeline/result-contract.js";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HASH = `sha256:${"1".repeat(64)}` as const;
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

const researchOutput = (decision: "proceed" | "decline") => ({
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
const articleOutput = {
  schema_version: "public-knowledge-article-output.v3", title: "旺衰判断的条件",
  editor_note: "说明边界", article_markdown: "## 判断边界\n不能机械计数。",
  citations: [], claim_coverage: [], safety_notes: [],
};

const seoTask = (actionId: WebsiteAgentTask["action_id"]): WebsiteAgentTask => ({
  job_id: `job-${actionId}`, action_id: actionId, product_id: "public_knowledge_article_pipeline",
  parameters: { domain_id: "bazi", locale: "zh-CN", ready_corpus_snapshot_hash: HASH },
  business_identity: { owner_ref: "owner", subject_ref: "subject", authorization_ref: "authorization" },
  ...(actionId === "produce_article" ? {} : {
    subject_task_ref: "subject-task", subject_result_ref: "subject-result",
    subject_result_hash: HASH, review_policy: "strict",
  }),
} as unknown as WebsiteAgentTask);

const exerciseSeoFlow = async (
  plugin: (typeof productionPluginCatalog)[number],
  actionId: "produce_article" | "accuracy_challenge" | "quality_reflection",
  decision: "proceed" | "decline" = "proceed",
  failureAt?: Readonly<{ child: string; code: string; productStepId?: string }>,
  recoverAfterFault = false,
) => {
  const calls: Array<Parameters<SharedExecutionContext["gpt"]["execute"]>[0]> = [];
  const factsByCall = new Map<string, Readonly<{
    evidenceRef: string;
    mutation: boolean;
    terminalAt: string | null;
  }>>();
  const handoffDelays: number[] = [];
  let completed: ProductPluginOutput | null = null;
  let continuationProvider: Readonly<Record<string, unknown>> | null = null;
  let continuationLaneVersion = 0;
  let continuationLaneOwned = false;
  let remainingFailures = failureAt ? 1 : 0;
  let physicalSubmitDispatches = 0;
  const acquiredLaneVersions: number[] = [];
  const providerNames = [
    gptAttachmentProviderDisplayName("one.json", "attempt-1", "m0"),
    gptAttachmentProviderDisplayName("two.json", "attempt-1", "m1"),
  ] as const;
  const factKey = (input: Readonly<{
    productStepId: string;
    callId: string;
    child: string;
    actionOrdinal: number;
    input: Readonly<Record<string, unknown>>;
  }>): string => hashCanonical({
    productStepId: input.productStepId,
    callId: input.callId,
    child: input.child,
    actionOrdinal: input.actionOrdinal,
    input: input.input,
  });
  const context = {
    materials: [
      { material_id: "m0", ordinal: 0, display_name: "one.json", local_path: "/tmp/one.json", sha256: HASH, bytes: 1 },
      { material_id: "m1", ordinal: 1, display_name: "two.json", local_path: "/tmp/two.json", sha256: HASH, bytes: 1 },
    ],
    gpt: {
      attemptId: "attempt-1",
      readContinuationForTurn: (marker: string) => continuationProvider
        && continuationProvider.prior_turn_marker === marker
        ? {
          continuation_ref: "gpt-continuation:test",
          lane_version: continuationLaneVersion,
          provider: continuationProvider,
        }
        : null,
      readCallFacts: async (input: Parameters<SharedExecutionContext["gpt"]["readCallFacts"]>[0]) => {
        const stored = factsByCall.get(factKey(input));
        return {
          exactCallIdentityHash: HASH,
          mutation: stored?.mutation ? {
            owner: "browser" as const,
            effectScope: "provider_effect" as const,
            outcome: "CONFIRMED" as const,
            terminalAt: stored.terminalAt,
          } : null,
          evidence: stored ? {
            owner: "forensics-persistence" as const,
            evidenceRef: stored.evidenceRef,
            evidenceHash: HASH,
            readbackVerified: true as const,
            artifactRefs: input.child === "checkpoint_gpt_text_response"
              ? ["artifact:checkpoint"] : [],
          } : null,
          continuation: null,
        };
      },
      execute: async (input: Parameters<SharedExecutionContext["gpt"]["execute"]>[0]) => {
        calls.push(input);
        if (remainingFailures > 0 && input.child === failureAt?.child
          && (!failureAt.productStepId || input.productStepId === failureAt.productStepId)) {
          remainingFailures -= 1;
          throw executionFailure("failed", failureAt.code);
        }
        const marker = `[GRASSEYE:${"a".repeat(24)}]`;
        const text = input.productStepId === "corpus_research"
          ? JSON.stringify(researchOutput(decision))
          : input.productStepId === "article_synthesis"
            ? JSON.stringify(articleOutput)
            : JSON.stringify({ decision: "no_issue", issues: [] });
        const values: Partial<Record<typeof input.child, unknown>> = {
          reconcile_gpt_attachment_set: {
            files: [
              { artifactRef: "m0", displayName: "one.json", providerDisplayName: providerNames[0], sha256: HASH, bytes: 1 },
              { artifactRef: "m1", displayName: "two.json", providerDisplayName: providerNames[1], sha256: HASH, bytes: 1 },
            ],
          },
          write_exact_gpt_prompt: { hash: HASH },
          reconcile_gpt_turn_submission: { canonicalConversationUrl: "https://chatgpt.com/c/example" },
          wait_for_stable_gpt_text: { assistantTurnId: "conversation-turn-2", responseHash: HASH, responseText: text },
          checkpoint_gpt_text_response: {
            assistantTurnId: "conversation-turn-2",
            rawDomHtml: `<div data-message-author-role="assistant">${text}</div>`,
            rawDomHash: HASH,
            semanticText: text,
            semanticTextHash: HASH,
          },
          persist_gpt_continuation: { continuationRef: "gpt-continuation:test" },
          wait_for_stable_gpt_image: { assistantTurnId: "conversation-turn-6", responseHash: HASH },
          checkpoint_gpt_generated_image: {
            artifactId: "image-1", localPath: "/tmp/image.webp", originalLocalPath: "/tmp/image.original",
            sha256: HASH, originalSha256: HASH, bytes: 42, mediaType: "image/webp", width: 1200, height: 630,
          },
        };
        if (input.child === "persist_gpt_continuation") {
          continuationProvider ??= input.input.provider as Readonly<Record<string, unknown>>;
        }
        let value: unknown = values[input.child] ?? {};
        if (input.child === "acquire_gpt_continuation_lane") {
          assert.equal(continuationLaneOwned, false, "released continuation must be reacquired physically");
          continuationLaneVersion += 1;
          acquiredLaneVersions.push(continuationLaneVersion);
          continuationLaneOwned = true;
          value = {
            continuation_ref: "gpt-continuation:test",
            lane_version: continuationLaneVersion,
            provider: continuationProvider,
          };
        }
        if (input.child === "advance_gpt_continuation_lane") {
          assert.equal(continuationLaneOwned, true);
          assert.equal(
            (input.input.lane as Readonly<Record<string, unknown>>).lane_version,
            continuationLaneVersion,
          );
          continuationProvider = input.input.provider as Readonly<Record<string, unknown>>;
          continuationLaneOwned = false;
        }
        if (input.child === "release_gpt_continuation_lane") {
          assert.equal(
            (input.input.lane as Readonly<Record<string, unknown>>).lane_version,
            continuationLaneVersion,
          );
          continuationLaneOwned = false;
        }
        const priorFact = factsByCall.get(factKey(input));
        if (input.child === "submit_exact_gpt_turn_once" && !priorFact) {
          physicalSubmitDispatches += 1;
        }
        const evidenceRef = priorFact?.evidenceRef ?? `evidence:${calls.length}`;
        factsByCall.set(factKey(input), {
          evidenceRef,
          mutation: input.child === "submit_exact_gpt_turn_once",
          terminalAt: input.child === "submit_exact_gpt_turn_once" ? "2020-01-01T00:00:00.000Z" : null,
        });
        return { value, evidenceRef, evidenceHash: HASH };
      },
    },
    complete: async (output: ProductPluginOutput) => {
      completed = output;
      return {} as Awaited<ReturnType<SharedExecutionContext["complete"]>>;
    },
  } as unknown as SharedExecutionContext;
  const nativeSetTimeout = globalThis.setTimeout;
  const acceleratedSetTimeout = ((
    handler: (...args: unknown[]) => void,
    timeout?: number,
    ...args: unknown[]
  ) => {
    handoffDelays.push(timeout ?? 0);
    return nativeSetTimeout(() => handler(...args), 0);
  }) as typeof setTimeout;
  globalThis.setTimeout = acceleratedSetTimeout;
  let firstFailure: unknown = null;
  try {
    try {
      await plugin.execute(seoTask(actionId), context);
    } catch (error) {
      if (!recoverAfterFault) throw error;
      firstFailure = error;
    }
    if (recoverAfterFault) await plugin.execute(seoTask(actionId), context);
  } finally {
    globalThis.setTimeout = nativeSetTimeout;
  }
  const output = completed as ProductPluginOutput | null;
  assert(output);
  if (!recoverAfterFault) {
    assert.deepEqual(calls.map((call) => call.actionOrdinal), calls.map((_call, index) => index + 1));
  }
  assert.equal(new Set(calls.map((call) => call.sessionKey)).size, 1);
  assert.ok(calls.every((call) => call.sessionKey.includes("attempt-1")));
  if (!recoverAfterFault) {
    assert.deepEqual(output.evidence_refs, calls.map((_call, index) => `evidence:${index + 1}`));
  }
  if (!recoverAfterFault) assert.equal(handoffDelays.length, Math.max(0, calls.length - 1));
  assert.ok(handoffDelays.every((delay) => delay === 2_000), "every adjacent SEO Child must retain a 2s handoff floor");
  const firstPrompt = calls.find((call) => call.child === "write_exact_gpt_prompt")?.input.prompt;
  assert.equal(typeof firstPrompt, "string");
  assert.match(firstPrompt as string, new RegExp(`${providerNames[0]} 与 ${providerNames[1]}`, "u"));
  if (actionId === "produce_article") {
    assert.match(firstPrompt as string, /public-knowledge-research-output\.v3/u);
    assert.match(firstPrompt as string, /本回合不得返回 article package/u);
    assert.doesNotMatch(firstPrompt as string, /ready_corpus_snapshot_hash|sha256:/u);
  }
  const firstDraftFiles = calls.find((call) => call.child === "reconcile_gpt_draft")?.input.files;
  assert.deepEqual(
    Array.isArray(firstDraftFiles)
      ? firstDraftFiles.map((file) => (file as { providerDisplayName?: unknown }).providerDisplayName)
      : null,
    providerNames,
  );
  return { calls, completed: output, firstFailure, physicalSubmitDispatches, acquiredLaneVersions };
};

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
assert.equal(parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"), topic_manifest: { primary_question: "incomplete" },
})).schema_version, "public-knowledge-research-output.v3",
"transport parsing must preserve a URL/hash-authenticated AI object without policing nested shape");
assert.equal(parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"), citations: [{ citation_id: "bad", book_id: "book", locator: "one" }],
})).schema_version, "public-knowledge-research-output.v3");
assert.equal(parsePublicKnowledgeArticle(JSON.stringify({
  ...articleOutput, claim_coverage: [{ claim_id: "CL1", status: "addressed", reason_if_omitted: "must-be-null" }],
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
    assert.equal(plugin.pluginVersion, 14);
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
      { child: "checkpoint_gpt_text_response", code: "GPT_CHECKPOINT_SOFTWARE_FAULT", productStepId: "article_synthesis" },
      true,
    );
    assert.equal(
      postSubmitReadbackReceipt(recovered.firstFailure)?.causeCode,
      "GPT_CHECKPOINT_SOFTWARE_FAULT",
      "article readback software fault must release and retain the same attempt",
    );
    assert.equal(recovered.physicalSubmitDispatches, 3,
      "restart must not physically dispatch research or article submit again");
    assert.deepEqual(recovered.acquiredLaneVersions, [1, 2, 3],
      "released article lane must be physically reacquired before advance");
    assert.ok(recovered.completed.generated_image);
    await assert.rejects(
      () => exerciseSeoFlow(plugin, "accuracy_challenge", "proceed", {
        child: "wait_for_stable_gpt_text", code: "GPT_USER_TURN_HASH_MISMATCH",
      }),
      (error: unknown) => postSubmitReadbackReceipt(error)?.causeCode === "GPT_USER_TURN_HASH_MISMATCH",
      "confirmed submit followed by a no-mutation readback software fault must preserve the same attempt",
    );
    await assert.rejects(
      () => exerciseSeoFlow(plugin, "accuracy_challenge", "proceed", {
        child: "wait_for_stable_gpt_text", code: "GPT_RESPONSE_STABILITY_TIMEOUT",
      }),
      (error: unknown) => typedExecutionFailure(error)?.code === "GPT_RESPONSE_STABILITY_TIMEOUT"
        && postSubmitReadbackReceipt(error) === null,
      "a terminal Provider wait deadline must end the attempt instead of entering same-attempt recovery",
    );
    for (const actionId of ["accuracy_challenge", "quality_reflection"] as const) {
      const review = await exerciseSeoFlow(plugin, actionId);
      assert.deepEqual(review.calls.map((call) => call.child), INITIAL_TEXT_SEQUENCE);
      assert.equal(review.calls.filter((call) => call.child === "submit_exact_gpt_turn_once").length, 1);
      assert.equal(review.calls.some((call) => call.child.includes("continuation")), false);
    }
  } else {
    assert.doesNotMatch(source, /context\.gpt\.execute/u);
    assert.match(source, new RegExp(`PRODUCT_FLOW_NOT_IMPLEMENTED:${plugin.pluginId}:`, "u"));
    await assert.rejects(
      () => plugin.execute(
        { action_id: firstRoute.actionId } as WebsiteAgentTask,
        {} as SharedExecutionContext,
      ),
      (error: unknown) => typedExecutionFailure(error)?.code
        === `PRODUCT_FLOW_NOT_IMPLEMENTED:${plugin.pluginId}:${firstRoute.actionId}`,
    );
  }
}

assert.equal(routeKeys.size, 39);
assert.deepEqual([...productIds].sort(), [...ProductionProductIdSchema.options].sort());
process.stdout.write("[ACCEPTANCE][agent-product-skills] PASS\n");
emitQualityProofObservation({
  passed: true,
  findings: [],
  lawId: "LAW-AGENT-PRODUCTION-RUNTIME-001-V14",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:1", "forbidden:15", "forbidden:16", "forbidden:2", "forbidden:21", "forbidden:22", "forbidden:29", "forbidden:5", "summary"],
  locator: "acceptance:agent-production-runtime:product-flow-golden",
  observedValue: "12 product plugins and one owned SEO flow exercised with exact child sequence and recovery branches",
});
