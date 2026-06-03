import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = process.cwd();
const requiredFiles = [
  ".github/instructions/agent-rules/modules/module-amazon-product-sync.instructions.md",
  "docs/法案辅助文件/GrassEye Amazon 产品更新同步施工图.md",
  "src/plugins/amazon-product-sync/amazon-product-sync.schema.ts",
  "src/plugins/amazon-product-sync/amazon-product-sync.flow.ts",
  "src/plugins/amazon-product-sync/amazon-product-sync-task-service.ts",
  "src/plugins/amazon-product-sync/amazon-product-sync.storage.ts",
  "src/plugins/amazon-product-sync/index.ts",
  "src/app/workbench-amazon-product-sync-routes.ts",
  "scripts/acceptance/amazon-product-sync.acceptance.ts",
];

const failures: string[] = [];

for (const file of requiredFiles) {
  if (!existsSync(resolve(repo, file))) {
    failures.push(`missing required file: ${file}`);
  }
}

const read = (file: string): string => readFileSync(resolve(repo, file), "utf8");
const boundary = read("src/app/workbench-api-boundary.ts");
const server = read("src/app/create-workbench-server.ts");
const pluginStatus = read("scripts/audit/config/plugin-status.json");
const flow = read("src/plugins/amazon-product-sync/amazon-product-sync.flow.ts");

for (const token of [
  "/api/plugins/amazon-product-sync/start",
  "/api/plugins/amazon-product-sync/status/",
  "jobOwner: \"amazon-product-sync\"",
]) {
  if (!boundary.includes(token)) failures.push(`boundary missing ${token}`);
}

if (!server.includes("handleAmazonProductSyncRequest")) {
  failures.push("server must route through handleAmazonProductSyncRequest");
}
if ((pluginStatus.match(/"pluginId": "amazon-product-sync"/g) ?? []).length !== 1) {
  failures.push("plugin-status must register amazon-product-sync exactly once");
}
for (const forbidden of ["setFileInputFiles(", "textInput("]) {
  if (flow.includes(forbidden)) {
    failures.push(`Phase 1 flow must stay read-only and not call ${forbidden}`);
  }
}
if (!flow.includes("expandSellerCentralParentRows") || !flow.includes("buildVariationExpansionProbeScript")) {
  failures.push("flow must include read-only parent variation expansion point probing before extraction");
}
for (const forbidden of [
  "rowMatchScore",
  "pickBestSkuRow",
  "findAfter",
  "readFieldAfter",
  ".includes(normalized)",
  "row.text.toUpperCase()",
]) {
  if (flow.includes(forbidden)) {
    failures.push(`flow must not use theoretical text fallback token: ${forbidden}`);
  }
}
for (const required of [
  "BrowserController",
  "browser.click",
  "VariationExpander-module__expanderHeader",
  "ProductDetails-module__container",
  "JanusSplitBox-module__row",
  "JanusSplitBox-module__panel",
]) {
  if (!flow.includes(required)) {
    failures.push(`flow missing verified structural DOM token: ${required}`);
  }
}

if (failures.length > 0) {
  process.stdout.write(`[AMAZON-PRODUCT-SYNC][FAIL]\n${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("[AMAZON-PRODUCT-SYNC][PASS] audit checks passed\n");
