import assert from "../audit/shared/governance-exam-assert.js";
import { existsSync, readFileSync } from "node:fs";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const read = (filePath: string): string => readFileSync(filePath, "utf8");

const appShell = read("src/app/app-shell/app-shell.ts");
const layout = read("src/app/app-shell/app-shell-layout.ts");
const workspace = read("src/app/app-shell/production-runtime-workspace.ts");
const sidebar = read("src/app/app-shell/sidebar.ts");
const inspector = read("src/app/app-shell/inspector.ts");
const runtimeConsole = read("src/app/app-shell/runtime-console.ts");
const client = read("src/app/workbench-home-client.ts");
const productionClient = read("src/app/workbench-production-runtime-client.ts");
const styles = [
  "src/app/app-shell/app-shell-styles.ts",
  "src/app/app-shell/app-shell-core-styles.ts",
  "src/app/app-shell/app-shell-workspace-styles.ts",
  "src/app/app-shell/app-shell-inspector-console-styles.ts",
].map(read).join("\n");

for (const token of [
  "data-app-shell",
  "renderCommandBar",
  "renderSidebar",
  "renderMainWorkspace",
  "renderInspector",
  "renderRuntimeConsole",
]) {
  assert(appShell.includes(token), `App Shell entry must include ${token}.`);
}

for (const token of [
  "command-bar",
  "sidebar",
  "workspace",
  "inspector",
  "runtime-console",
  "status-badge",
  "detail-section",
  "empty-state",
  "loading-state",
  "error-state",
  "manual-required-state",
  "failed-state",
]) {
  assert(styles.includes(token), `App Shell styles must define ${token}.`);
}

assert(sidebar.includes("skillRegistry"), "Sidebar must render from Skill Registry.");
assert(layout.includes("renderProductionRuntimeWorkspace"), "Main workspace must render the production runtime workspace.");
assert(workspace.includes('data-skill-workspace="production-runtime"'));
assert(workspace.includes("appShellProductionPluginSupport"), "Catalog support must be projected from the unique Catalog.");
assert(workspace.includes("data-production-status"));
assert(workspace.includes("data-production-atomic-steps"));
assert(workspace.includes("data-production-atomic-step-rows"));
assert(productionClient.includes("[data-production-status]"));
assert(productionClient.includes("renderProductionAtomicSteps(payload.atomic_steps)"));
assert(productionClient.includes("productionAtomicCommandId"));
assert(productionClient.includes('"/api/production-runtime/status?jobId="'));
for (const forbidden of ["data-production-pause", "data-production-cancel", "data-production-takeover", "data-production-resume"]) {
  assert.equal(workspace.includes(forbidden), false, `Diagnostic Shell must not expose execution control ${forbidden}.`);
}
assert(inspector.includes("data-app-shell-inspector"), "Right Inspector must exist.");
assert(runtimeConsole.includes("data-runtime-console"), "Bottom Runtime Console must exist.");
assert(client.includes("openInspector"), "Client must support Level 3 detail Inspector.");
assert(client.includes("resetInspector"), "Skill switching must clear stale Inspector detail.");
assert(appShell.includes('class="inspector-collapsed"'), "Inspector must be closed by default.");

for (const retiredPath of [
  "src/app/app-shell/amazon-invoice-workspace.ts",
  "src/app/skills/amazon-product-mining",
  "src/app/skills/media-optimizer",
  "src/app/app-shell/xuanxue-ai-production-workspace.ts",
  "src/app/workbench-xuanxue-ai-production-client.ts",
  "src/app/workbench-xuanxue-ai-production-routes.ts",
]) {
  assert.equal(existsSync(retiredPath), false, `Retired App Shell surface remains: ${retiredPath}`);
}

process.stdout.write("[ACCEPTANCE][app-shell-ui] PASS\n");
emitQualityProofObservation({ lawId: "LAW-APP-SHELL-UI-001-V2", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:2","forbidden:3","forbidden:4","forbidden:9","summary"], locator: "acceptance:app-shell-ui:single-shell-layout", observedValue: "single governed App Shell layout, Skill Registry, allowed actions and retired surfaces verified" });
