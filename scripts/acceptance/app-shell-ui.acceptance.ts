import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

const read = (filePath: string): string => readFileSync(filePath, "utf8");

const appShell = read("src/app/app-shell/app-shell.ts");
const layout = read("src/app/app-shell/app-shell-layout.ts");
const workspace = read("src/app/app-shell/xuanxue-ai-production-workspace.ts");
const sidebar = read("src/app/app-shell/sidebar.ts");
const inspector = read("src/app/app-shell/inspector.ts");
const runtimeConsole = read("src/app/app-shell/runtime-console.ts");
const client = read("src/app/workbench-home-client.ts");
const xuanxueClient = read("src/app/workbench-xuanxue-ai-production-client.ts");
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
assert(layout.includes("renderXuanxueAiProductionWorkspace"), "Main workspace must render only the xuanxue workspace.");
assert(workspace.includes('data-skill-workspace="xuanxue-ai-production"'));
for (const action of ["status", "pause", "cancel", "takeover", "resume"]) {
  assert(workspace.includes(`data-xuanxue-${action}`), `Xuanxue workspace must expose ${action}.`);
  assert(xuanxueClient.includes(`[data-xuanxue-${action}]`), `Xuanxue client must bind ${action}.`);
}
assert(xuanxueClient.includes('"/api/xuanxue-ai-production/" + action'));
assert(inspector.includes("data-app-shell-inspector"), "Right Inspector must exist.");
assert(runtimeConsole.includes("data-runtime-console"), "Bottom Runtime Console must exist.");
assert(client.includes("openInspector"), "Client must support Level 3 detail Inspector.");
assert(client.includes("resetInspector"), "Skill switching must clear stale Inspector detail.");
assert(appShell.includes('class="inspector-collapsed"'), "Inspector must be closed by default.");

for (const retiredPath of [
  "src/app/app-shell/amazon-invoice-workspace.ts",
  "src/app/skills/amazon-product-mining",
  "src/app/skills/media-optimizer",
]) {
  assert.equal(existsSync(retiredPath), false, `Retired App Shell surface remains: ${retiredPath}`);
}

process.stdout.write("[ACCEPTANCE][app-shell-ui] PASS\n");
emitQualityProofObservation({ lawId: "LAW-APP-SHELL-UI-001-V2", evidenceMode: "exam.golden", locator: "acceptance:app-shell-ui:single-shell-layout", observedValue: "single governed App Shell layout and retired surfaces verified" });
