import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname } from "node:path";

import {
  agentPluginCapabilityManifest,
  productionPluginCatalog,
  resolveProductionPlugin,
} from "../../src/lib/local-runtime/production/catalog.js";
import { ProductionProductIdSchema, hashCanonical } from "../../src/lib/local-runtime/production/contracts.js";

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

assert.equal(productionPluginCatalog.length, 12);
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
  assert.deepEqual(Object.keys(plugin).sort(), ["accepts", "checkpointSchemaVersion", "execute", "pluginId", "pluginVersion", "skillHash"]);
  const skillPath = new URL(`../../src/plugins/${plugin.pluginId}/SKILL.md`, import.meta.url).pathname;
  assert.equal(readdirSync(dirname(skillPath)).filter((name) => name.toLowerCase() === "skill.md").length, 1);
  const text = readFileSync(skillPath, "utf8");
  const productIds = [...new Set(plugin.accepts.map((entry) => entry.productId))];
  assert.deepEqual(inspectSkill(productIds, text), [], `${plugin.pluginId} is not a production-grade Product Skill`);

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
