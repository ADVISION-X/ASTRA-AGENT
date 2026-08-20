import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registry = readFileSync("src/app/app-shell/skill-registry.ts", "utf8");
const sidebar = readFileSync("src/app/app-shell/sidebar.ts", "utf8");

for (const requiredId of [
  'id: "amazon-product-mining"',
]) {
  assert(registry.includes(requiredId), `Skill Registry must include ${requiredId}.`);
}

for (const field of [
  "id",
  "label",
  "category",
  "description",
  "route",
  "status",
  "primarySurface",
  "historySurface",
  "detailSurface",
  "allowedActions",
  "forbiddenActions",
]) {
  assert(registry.includes(`${field}:`), `Skill Registry items must include ${field}.`);
}

assert(sidebar.includes("skillRegistry.map"), "Sidebar must render skills from the registry array.");
assert(!sidebar.includes("Amazon Product Mining</strong>"), "Sidebar must not hardcode skill labels outside registry.");

process.stdout.write("[ACCEPTANCE][app-shell-skill-registry] PASS\n");
