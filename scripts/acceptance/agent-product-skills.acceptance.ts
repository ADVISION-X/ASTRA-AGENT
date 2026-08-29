import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
import type { ProductPluginOutput, ProviderTurnResult } from "../../src/lib/local-runtime/production/plugin.js";
import { productionRoutePolicies } from "../../src/lib/local-runtime/production/route-policy.js";
import { HASH_A, task } from "./agent-production-runtime-fixtures.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PLUGIN_VERSION = /pluginVersion:\s*([1-9][0-9]*)/u;

const pluginVersion = (source: string, label: string): number => {
  const match = PLUGIN_VERSION.exec(source);
  assert(match?.[1], `${label} pluginVersion missing`);
  return Number(match[1]);
};

const assertPluginSemanticChangesBumpVersion = (input: Readonly<{
  changedFiles: readonly string[];
  beforeIndex: (pluginId: string) => string;
  afterIndex: (pluginId: string) => string;
}>): void => {
  const changedPlugins = new Set(input.changedFiles.flatMap((path) => {
    const match = /^src\/plugins\/([^/]+)\/(?:SKILL\.md|.*\.ts)$/u.exec(path);
    return match?.[1] ? [match[1]] : [];
  }));
  for (const pluginId of changedPlugins) {
    assert(
      pluginVersion(input.afterIndex(pluginId), `${pluginId}:after`)
        > pluginVersion(input.beforeIndex(pluginId), `${pluginId}:before`),
      `${pluginId} semantic code changed without pluginVersion bump`,
    );
  }
};

const providerRepository = (): string => {
  const configured = process.env.GRASSEYE_PROVIDER_REPOSITORIES?.trim();
  if (configured) {
    const value = (JSON.parse(configured) as Record<string, unknown>)["ADVISION-X/xuanxue-web"];
    if (typeof value === "string" && value.trim()) return resolve(value);
  }
  return resolve(ROOT, "../xuanxue-web");
};

const localProjection = JSON.parse(readFileSync(resolve(
  ROOT, "src/lib/local-runtime/production/website-agent-route-policies.v1.json",
), "utf8")) as unknown;
const providerProjectionPath = resolve(
  providerRepository(), "packages/ai-contracts/src/agent-task/website-agent-route-policies.v1.json",
);
assert(existsSync(providerProjectionPath), "website route-policy provider artifact missing");
assert.deepEqual(localProjection, JSON.parse(readFileSync(providerProjectionPath, "utf8")),
  "AGENT route-policy projection drifted from website provider");
assert.equal(productionRoutePolicies.length, 39);

const candidate = process.env.GOVERNANCE_PROOF_CANDIDATE?.trim();
const base = candidate ? `${candidate}^` : "HEAD";
const target = candidate ?? null;
const changedFiles = execFileSync("git", ["diff", "--name-only", base, ...(target ? [target] : []), "--", "src/plugins"], {
  cwd: ROOT, encoding: "utf8",
}).trim().split("\n").filter(Boolean);
assertPluginSemanticChangesBumpVersion({
  changedFiles,
  beforeIndex: (pluginId) => execFileSync("git", ["show", `${base}:src/plugins/${pluginId}/index.ts`], {
    cwd: ROOT, encoding: "utf8",
  }),
  afterIndex: (pluginId) => target
    ? execFileSync("git", ["show", `${target}:src/plugins/${pluginId}/index.ts`], { cwd: ROOT, encoding: "utf8" })
    : readFileSync(resolve(ROOT, `src/plugins/${pluginId}/index.ts`), "utf8"),
});
assert.throws(() => assertPluginSemanticChangesBumpVersion({
  changedFiles: ["src/plugins/mutant/index.ts"],
  beforeIndex: () => "pluginVersion: 7,",
  afterIndex: () => "pluginVersion: 7, // semantic change without bump",
}), /semantic code changed without pluginVersion bump/u);

const forbiddenExecutionSyntax = [
  /\bStage\b/u,
  /\bBrowser\b/u,
  /\brunTurn\b/u,
  /\bstep_id\b/u,
  /\bcheckpoint(?:_schema_version)?\b/u,
  /\bprovider_execution_profile\b/u,
  /\bsame_conversation_as\b/u,
  /\buse_task_continuation\b/u,
  /\bmaterial_roles\b/u,
  /^##\s+(?:Flow|执行流程|状态机|模型选择|恢复算法)\b/gmu,
] as const;

const inspectSkill = (productIds: readonly string[], text: string): string[] => {
  const findings: string[] = [];
  const normalized = text.normalize("NFC");
  const substantiveLines = normalized.split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const sections = [...normalized.matchAll(/^##\s+\S+/gmu)].length;
  if (normalized !== text || text.includes("\r")) findings.push("skill-text-not-canonical");
  if (Buffer.byteLength(text, "utf8") < 1_400 || substantiveLines.length < 8 || sections < 3) {
    findings.push("skill-content-shell");
  }
  for (const productId of productIds) {
    if (!text.includes(productId)) findings.push(`skill-product-identity-missing:${productId}`);
  }
  if (!text.includes("复核")) findings.push("skill-review-policy-missing");
  for (const pattern of forbiddenExecutionSyntax) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) findings.push(`skill-execution-truth-leak:${pattern.source}`);
  }
  return findings;
};

const assertSharedGptFlowOwnership = (pluginId: string): void => {
  const flowPath = new URL(`../../src/plugins/${pluginId}/gpt-flow.ts`, import.meta.url).pathname;
  assert.equal(existsSync(flowPath), false, `${pluginId} must not own a GPT provider-page flow file`);
  const source = readFileSync(new URL(`../../src/plugins/${pluginId}/index.ts`, import.meta.url), "utf8");
  assert.doesNotMatch(source, /gpt_flow|gpt-flow/u, `${pluginId} must not own provider-page step order`);
  assert.match(source, /checkpointSchemaVersion: 2/u, `${pluginId} must bind atomic checkpoint schema v2`);
};

assert.equal(productionPluginCatalog.length, 12);
assert.equal(existsSync(resolve(ROOT, "src/lib/local-runtime/production/output-contract.ts")), false,
  "the shared runtime must not own Product payload semantics");
assert.equal(existsSync(resolve(ROOT, "src/plugins/product-result-contract.ts")), false,
  "a top-level cross-Product result contract must remain physically absent");
const executorSource = readFileSync(resolve(ROOT, "src/lib/local-runtime/production/executor.ts"), "utf8");
assert.match(executorSource, /authorized\.plugin\.parseResult\(authorized\.task, output\.payload, "draft"\)/u,
  "context.complete must invoke the selected Product Plugin parser before upload");
const cloudClientSource = readFileSync(resolve(ROOT, "src/lib/local-runtime/production/cloud-client.ts"), "utf8");
assert.match(cloudClientSource, /resolveProductionPlugin\(input\.job\.product_id, input\.job\.action_id\)[\s\S]*?\.plugin\.parseResult\(input\.job, prepared\.payload, "final"\)/u,
  "the final receipt-injected payload must return to the same Product Plugin parser");
assert.deepEqual(
  agentPluginCapabilityManifest.plugins.map((plugin) => plugin.plugin_id).sort(),
  productionPluginCatalog.map((plugin) => plugin.pluginId).sort(),
);
assert.deepEqual(Object.keys(agentPluginCapabilityManifest).sort(), ["catalog_hash", "plugins", "schema_version"]);
assert.equal(hashCanonical(agentPluginCapabilityManifest.plugins), agentPluginCapabilityManifest.catalog_hash);

const skillHashes = new Set<string>();
const routeKeys = new Set<string>();
const catalogProductIds = new Set<string>();
for (const plugin of productionPluginCatalog) {
  assert.deepEqual(Object.keys(plugin).sort(), [
    "accepts", "checkpointSchemaVersion", "execute", "parseResult", "pluginId", "pluginVersion", "skillHash",
  ]);
  const skillPath = new URL(`../../src/plugins/${plugin.pluginId}/SKILL.md`, import.meta.url).pathname;
  const resultContractPath = new URL(`../../src/plugins/${plugin.pluginId}/result-contract.ts`, import.meta.url).pathname;
  const implementationPath = new URL(`../../src/plugins/${plugin.pluginId}/index.ts`, import.meta.url).pathname;
  assert.equal(readdirSync(dirname(skillPath)).filter((name) => name.toLowerCase() === "skill.md").length, 1);
  assert.equal(existsSync(resultContractPath), true, `${plugin.pluginId} must own its result contract`);
  assert.match(readFileSync(resultContractPath, "utf8"), /export const parseProductResult/u);
  assert.match(readFileSync(implementationPath, "utf8"), /from "\.\/result-contract\.js"/u);
  const text = readFileSync(skillPath, "utf8");
  assertSharedGptFlowOwnership(plugin.pluginId);
  const productIds = [...new Set(plugin.accepts.map((entry) => entry.productId))];
  assert.deepEqual(inspectSkill(productIds, text), [], `${plugin.pluginId} is not a production-grade Product Skill`);
  if (plugin.pluginId === "localization-production") {
    assert.match(text, /目标 locale、术语表和 locale policy/u);
    assert.match(text, /zh-HK.*zh-TW.*en-US.*ja-JP.*ko-KR/u);
    assert.match(text, /不得重新读取人物档案、命盘底层资料或 FrozenSubject/u);
    const implementation = readFileSync(new URL("../../src/plugins/localization-production/index.ts", import.meta.url), "utf8");
    for (const privateStep of ["candidate_a", "candidate_b", "private_review", "private_selector"]) {
      assert.match(implementation, new RegExp(privateStep, "u"), `localization private Flow misses ${privateStep}`);
    }
    assert.match(implementation, /不得生成第三份译文/u);
    assert.match(implementation, /非生成式 selector/u);
    assert.match(implementation, /selection\.selected_candidate === "A" \? candidateA : candidateB/u);
    assert.equal((implementation.match(/parseRouteResult\(task, candidateA\.raw_text\)/gu) ?? []).length, 1);
    assert.equal((implementation.match(/parseRouteResult\(task, candidateB\.raw_text\)/gu) ?? []).length, 1);
    assert.doesNotMatch(implementation, /localization_static_review_candidate|localization_static_review_selector/u);
  }
  if (plugin.pluginId === "public-knowledge-article-pipeline") {
    const implementation = readFileSync(implementationPath, "utf8");
    assert.equal(plugin.pluginVersion, 7, "SEO flow semantic revision must publish pluginVersion 7");
    for (const productStep of ["corpus_research", "article_synthesis", "article_image_generation"]) {
      assert.equal((implementation.match(new RegExp(`step_id: "${productStep}"`, "gu")) ?? []).length, 1,
        `SEO primary Flow must own exactly one ${productStep} step`);
    }
    assert(implementation.indexOf('step_id: "corpus_research"')
      < implementation.indexOf('step_id: "article_synthesis"'));
    assert(implementation.indexOf('step_id: "article_synthesis"')
      < implementation.indexOf('step_id: "article_image_generation"'));
    assert.match(implementation,
      /step_id: "corpus_research",[\s\S]*?material_roles: \["ready_corpus_archive", "result_contract"\]/u);
    assert.match(implementation,
      /step_id: "article_synthesis",[\s\S]*?material_roles: \[\],[\s\S]*?same_conversation_as: research/u);
    assert.match(implementation,
      /step_id: "article_image_generation",[\s\S]*?material_roles: \[\],[\s\S]*?same_conversation_as: article,[\s\S]*?output_kind: "generated_image"/u);
    assert.match(implementation,
      /researchPayload\.decision === "decline"[\s\S]*?article: null, image: null/u);
    assert.match(implementation, /continuation: image\.provider_continuation/u);
    assert.doesNotMatch(implementation,
      /step_id: "(?:article_synthesis|article_image_generation)"[\s\S]{0,700}?material_roles: \[(?!\])/u,
      "SEO follow-on turns must not upload materials again");
  }

  for (const entry of plugin.accepts) {
    const key = `${entry.productId}\0${entry.actionId}`;
    assert(!routeKeys.has(key), `duplicate Product route ${key}`);
    routeKeys.add(key);
    catalogProductIds.add(entry.productId);
  }
  for (const productId of productIds) {
    const actions = plugin.accepts.filter((entry) => entry.productId === productId).map((entry) => entry.actionId);
    assert(actions.includes("accuracy_challenge"));
    assert(actions.includes("quality_reflection"));
  }

  const digest = `sha256:${createHash("sha256").update(text.normalize("NFC")).digest("hex")}`;
  assert(!skillHashes.has(digest), `${plugin.pluginId} duplicates another Product Skill`);
  skillHashes.add(digest);
  assert.equal(plugin.skillHash, digest);
  const manifestEntry = agentPluginCapabilityManifest.plugins.find((entry) => entry.plugin_id === plugin.pluginId);
  assert(manifestEntry);
  assert.deepEqual(Object.keys(manifestEntry).sort(), ["accepts", "plugin_id", "plugin_version", "result_contract_version", "task_contract_version"]);
  assert(manifestEntry.accepts.every((entry) => Object.keys(entry).sort().join(",") === "action_id,product_id"));
  const firstRoute = plugin.accepts[0]!;
  assert.equal(resolveProductionPlugin(firstRoute.productId, firstRoute.actionId).skill_text, text.normalize("NFC"));
}
assert.deepEqual([...catalogProductIds].sort(), [...ProductionProductIdSchema.options].sort());

const firstText = readFileSync(new URL(`../../src/plugins/${productionPluginCatalog[0]!.pluginId}/SKILL.md`, import.meta.url), "utf8");
const firstProductIds = [...new Set(productionPluginCatalog[0]!.accepts.map((entry) => entry.productId))];
assert(inspectSkill(firstProductIds, "# 空壳\n\n只有一句说明。").includes("skill-content-shell"));
assert(inspectSkill(firstProductIds, `${firstText}\n\n## 执行流程\nStage 1 调用 Browser。`).some((finding) => finding.startsWith("skill-execution-truth-leak:")));
assert(inspectSkill(firstProductIds, firstText.replace(firstProductIds[0]!, "")).includes(`skill-product-identity-missing:${firstProductIds[0]}`));

const seoPlugin = resolveProductionPlugin("public_knowledge_article_pipeline", "produce_article").plugin;
const seoTask = task({
  jobId: "job:seo-product-flow",
  productId: "public_knowledge_article_pipeline",
  actionId: "produce_article",
});
const researchOutput = {
  schema_version: "public-knowledge-research-output.v3",
  decision: "proceed",
  topic_manifest: { topic: "可核验的新主题" },
  editorial_intent: "向普通读者解释一个有来源闭包的新主题",
  catalog_comparison_note: "与现役目录没有实质重复",
  research_markdown: "研究正文",
  citations: [],
  uncertainties: [],
  research_claim_units: [],
  closest_existing_article_ids: [],
  relation_assertions: [],
  novelty_basis: "现役目录未覆盖该问题",
};
const articleOutput = {
  schema_version: "public-knowledge-article-output.v3",
  title: "可核验的新主题",
  editor_note: "依据冻结研究材料编写",
  article_markdown: "文章正文",
  citations: [],
  claim_coverage: [],
  safety_notes: [],
};
const continuation = {
  provider_page_url: "provider:seo-product-flow",
  prior_task_id: "provider-task:seo-product-flow",
  prior_raw_output_hash: HASH_A,
  prior_turn_marker: "turn:seo-product-flow",
};
const imageArtifact = {
  artifact_id: "artifact:seo-hero",
  local_path: "/tmp/seo-hero.webp",
  original_local_path: "/tmp/seo-hero-original.png",
  sha256: HASH_A,
  original_sha256: HASH_A,
  bytes: 10,
  media_type: "image/webp" as const,
  width: 1200 as const,
  height: 630 as const,
};
type SeoTurnInput = Parameters<Parameters<typeof seoPlugin.execute>[1]["runTurn"]>[0];
const seoTurns: SeoTurnInput[] = [];
let researchTurnResult: ProviderTurnResult | undefined;
let articleTurnResult: ProviderTurnResult | undefined;
const seoCompletions: ProductPluginOutput[] = [];
await seoPlugin.execute(seoTask, {
  materials: [],
  runTurn: async (input) => {
    seoTurns.push(input);
    const common = { raw_hash: HASH_A, evidence_refs: [`evidence:${input.step_id}`], provider_continuation: continuation };
    if (input.step_id === "corpus_research") {
      researchTurnResult = { ...common, raw_text: JSON.stringify(researchOutput) };
      return researchTurnResult;
    }
    if (input.step_id === "article_synthesis") {
      articleTurnResult = { ...common, raw_text: JSON.stringify(articleOutput) };
      return articleTurnResult;
    }
    if (input.step_id === "article_image_generation") return { ...common, raw_text: "", generated_image: imageArtifact };
    throw new Error(`SEO_UNEXPECTED_STEP:${input.step_id}`);
  },
  complete: async (output) => {
    seoCompletions.push(output);
    seoPlugin.parseResult(seoTask, output.payload, "draft");
    return {} as never;
  },
});
assert.deepEqual(seoTurns.map((turn) => turn.step_id), [
  "corpus_research", "article_synthesis", "article_image_generation",
]);
assert.deepEqual(seoTurns.map((turn) => turn.material_roles), [
  ["ready_corpus_archive", "result_contract"], [], [],
]);
assert.equal(seoTurns[1]?.same_conversation_as, researchTurnResult);
assert.equal(seoTurns[2]?.same_conversation_as, articleTurnResult);
assert.equal(seoTurns[2]?.output_kind, "generated_image");
assert.equal(seoCompletions.length, 1);
assert.equal(seoCompletions[0]?.continuation, continuation);
assert.equal(seoCompletions[0]?.generated_image, imageArtifact);
assert.deepEqual((seoCompletions[0]?.payload as Record<string, unknown>).image, null);

const declineTurns: string[] = [];
let declinePayload: unknown;
await seoPlugin.execute(seoTask, {
  materials: [],
  runTurn: async (input) => {
    declineTurns.push(input.step_id);
    return {
      raw_text: JSON.stringify({ ...researchOutput, decision: "decline" }),
      raw_hash: HASH_A,
      evidence_refs: ["evidence:corpus_research"],
      provider_continuation: continuation,
    };
  },
  complete: async (output) => {
    declinePayload = output.payload;
    seoPlugin.parseResult(seoTask, output.payload, "draft");
    return {} as never;
  },
});
assert.deepEqual(declineTurns, ["corpus_research"]);
assert.deepEqual(declinePayload, {
  schema_version: "public-knowledge-article-package.v1",
  research: { ...researchOutput, decision: "decline" },
  article: null,
  image: null,
});

process.stdout.write("[ACCEPTANCE][agent-product-skills] PASS\n");
