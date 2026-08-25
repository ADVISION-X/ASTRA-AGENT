import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const registry = readFileSync("src/app/app-shell/skill-registry.ts", "utf8");
const sidebar = readFileSync("src/app/app-shell/sidebar.ts", "utf8");

for (const requiredId of [
  'id: "xuanxue-ai-production"',
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
assert(!registry.includes("amazon-product-mining"), "Retired Amazon Product Mining must not remain in Skill Registry.");
assert(!registry.includes("amazon-invoice-upload"), "Retired Amazon Invoice Upload must not remain in Skill Registry.");
assert(!registry.includes("media-optimizer"), "Retired Media Optimizer must not remain in Skill Registry.");

process.stdout.write("[ACCEPTANCE][app-shell-skill-registry] PASS\n");
emitQualityProofObservation({ lawId: "LAW-APP-SHELL-UI-003-V2", evidenceMode: "exam.golden", locator: "acceptance:app-shell-ui:active-skill-registry", observedValue: "sidebar renders sole active skill registry and retired skills are absent" });
