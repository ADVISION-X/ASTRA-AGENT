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
import { productionRoutePolicies } from "../../src/lib/local-runtime/production/route-policy.js";

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

const assertAtomicGptFlows = (pluginId: string): void => {
  const flowPath = new URL(`../../src/plugins/${pluginId}/gpt-flow.ts`, import.meta.url).pathname;
  const text = readFileSync(flowPath, "utf8");
  const flows = [...text.matchAll(/export const [A-Za-z0-9_]+ = Object\.freeze\(\[([\s\S]*?)\] satisfies/gmu)];
  assert(flows.length >= 1, `${pluginId} must own at least one GPT flow`);
  for (const flow of flows) {
    const body = flow[1] ?? "";
    for (const childCapabilityId of [
      "open_gpt_model_selector",
      "open_gpt_reasoning_selector",
      "open_gpt_title_control",
    ]) {
      assert.equal(
        [...body.matchAll(new RegExp(`childCapabilityId: "${childCapabilityId}"`, "gu"))].length,
        1,
        `${pluginId} repeats atomic GPT action ${childCapabilityId} in one turn flow`,
      );
    }
  }
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
assert.match(cloudClientSource, /resolveProductionPlugin\(job\.product_id, job\.action_id\)\.plugin\.parseResult\(job, payload, "final"\)/u,
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
  assertAtomicGptFlows(plugin.pluginId);
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

process.stdout.write("[ACCEPTANCE][agent-product-skills] PASS\n");
