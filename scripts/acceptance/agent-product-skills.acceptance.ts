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
import { ProductionProductIdSchema, hashCanonical, type WebsiteAgentTask } from "../../src/lib/local-runtime/production/contracts.js";
import type { ProductPluginOutput, SharedExecutionContext } from "../../src/lib/local-runtime/production/plugin.js";
import { typedExecutionFailure } from "../../src/lib/typed-failure.js";
import { productionRoutePolicies } from "../../src/lib/local-runtime/production/route-policy.js";
import { parsePublicKnowledgeArticle, parsePublicKnowledgeResearch } from "../../src/plugins/public-knowledge-article-pipeline/result-contract.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const HASH = `sha256:${"1".repeat(64)}` as const;

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
  parameters: { domain_id: "bazi", locale: "zh-CN" },
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
) => {
  const calls: Array<Parameters<SharedExecutionContext["gpt"]["execute"]>[0]> = [];
  let completed: ProductPluginOutput | null = null;
  const context = {
    materials: [
      { material_id: "m0", ordinal: 0, display_name: "one.json", local_path: "/tmp/one.json", sha256: HASH, bytes: 1 },
      { material_id: "m1", ordinal: 1, display_name: "two.json", local_path: "/tmp/two.json", sha256: HASH, bytes: 1 },
    ],
    gpt: {
      attemptId: "attempt-1",
      execute: async (input: Parameters<SharedExecutionContext["gpt"]["execute"]>[0]) => {
        calls.push(input);
        const marker = `[GRASSEYE:${"a".repeat(24)}]`;
        const text = input.productStepId === "corpus_research"
          ? JSON.stringify(researchOutput(decision))
          : input.productStepId === "article_synthesis"
            ? JSON.stringify(articleOutput)
            : JSON.stringify({ decision: "no_issue", issues: [] });
        const values: Partial<Record<typeof input.child, unknown>> = {
          write_exact_gpt_prompt: { hash: HASH },
          reconcile_gpt_turn_submission: { canonicalConversationUrl: "https://chatgpt.com/c/example" },
          wait_for_stable_gpt_text: { assistantTurnId: "conversation-turn-2", responseHash: HASH, responseText: text },
          checkpoint_gpt_text_response: { assistantTurnId: "conversation-turn-2", rawText: text, rawHash: HASH },
          persist_gpt_continuation: { continuationRef: "gpt-continuation:test" },
          acquire_gpt_continuation_lane: {
            continuation_ref: "gpt-continuation:test", lane_version: 1,
            provider: { provider_page_url: "https://chatgpt.com/c/example", prior_task_id: "job",
              prior_raw_output_hash: HASH, prior_turn_marker: marker },
          },
          wait_for_stable_gpt_image: { assistantTurnId: "conversation-turn-6", responseHash: HASH },
          checkpoint_gpt_generated_image: {
            artifactId: "image-1", localPath: "/tmp/image.webp", originalLocalPath: "/tmp/image.original",
            sha256: HASH, originalSha256: HASH, bytes: 42, mediaType: "image/webp", width: 1200, height: 630,
          },
        };
        return { value: values[input.child] ?? {}, evidenceRef: `evidence:${calls.length}`, evidenceHash: HASH };
      },
    },
    complete: async (output: ProductPluginOutput) => {
      completed = output;
      return {} as Awaited<ReturnType<SharedExecutionContext["complete"]>>;
    },
  } as unknown as SharedExecutionContext;
  await plugin.execute(seoTask(actionId), context);
  const output = completed as ProductPluginOutput | null;
  assert(output);
  assert.deepEqual(calls.map((call) => call.actionOrdinal), calls.map((_call, index) => index + 1));
  assert.equal(new Set(calls.map((call) => call.sessionKey)).size, 1);
  assert.ok(calls.every((call) => call.sessionKey.includes("attempt-1")));
  assert.deepEqual(output.evidence_refs, calls.map((_call, index) => `evidence:${index + 1}`));
  return { calls, completed: output };
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
assert.throws(() => parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"), topic_manifest: { primary_question: "incomplete" },
})), /PUBLIC_KNOWLEDGE_TOPIC_MANIFEST_INVALID/u);
assert.throws(() => parsePublicKnowledgeResearch(JSON.stringify({
  ...researchOutput("proceed"), citations: [{ citation_id: "bad", book_id: "book", locator: "one" }],
})), /PUBLIC_KNOWLEDGE_RESEARCH_CITATIONS_INVALID/u);
assert.throws(() => parsePublicKnowledgeArticle(JSON.stringify({
  ...articleOutput, claim_coverage: [{ claim_id: "CL1", status: "addressed", reason_if_omitted: "must-be-null" }],
})), /PUBLIC_KNOWLEDGE_CLAIM_COVERAGE_INVALID/u);

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
    assert.equal(plugin.pluginVersion, 9);
    assert.doesNotMatch(source, /PRODUCT_FLOW_NOT_IMPLEMENTED:/u);
    assert.match(source, /corpus_research/u);
    assert.match(source, /article_synthesis/u);
    assert.match(source, /article_image_generation/u);
    const decline = await exerciseSeoFlow(plugin, "produce_article", "decline");
    assert.equal(decline.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1);
    assert.equal(decline.calls.some((call) => call.productStepId === "article_synthesis"), false);
    const proceed = await exerciseSeoFlow(plugin, "produce_article", "proceed");
    assert.deepEqual([...new Set(proceed.calls.map((call) => call.productStepId))], [
      "corpus_research", "article_synthesis", "article_image_generation",
    ]);
    assert.equal(proceed.calls.filter((call) => call.child === "attach_approved_gpt_files_once").length, 1);
    assert.equal(proceed.calls.filter((call) => call.child === "submit_exact_gpt_turn_once").length, 3);
    assert.equal(proceed.calls.filter((call) => call.child === "advance_gpt_continuation_lane").length, 2);
    assert.ok(proceed.completed.generated_image);
    for (const actionId of ["accuracy_challenge", "quality_reflection"] as const) {
      const review = await exerciseSeoFlow(plugin, actionId);
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
