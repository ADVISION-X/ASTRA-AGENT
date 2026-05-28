import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

const appShell = read("src/app/app-shell/app-shell.ts");
const sidebar = read("src/app/app-shell/sidebar.ts");
const layout = read("src/app/app-shell/app-shell-layout.ts");
const inspector = read("src/app/app-shell/inspector.ts");
const runtimeConsole = read("src/app/app-shell/runtime-console.ts");
const styles = [
  "src/app/app-shell/app-shell-styles.ts",
  "src/app/app-shell/app-shell-core-styles.ts",
  "src/app/app-shell/app-shell-workspace-styles.ts",
  "src/app/app-shell/app-shell-inspector-console-styles.ts",
].map(read).join("\n");
const home = read("src/app/workbench-home-page.ts");
const client = read("src/app/workbench-home-client.ts");
const migrationTable = read("MIGRATION_FILE_DECISION_TABLE.md");

assert(!existsSync("docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md"), "Legacy APP user-demand startup blueprint must be physically absent.");
assert(!migrationTable.includes("docs/法案辅助文件/GrassEye APP 用户需求启动施工图.md"), "Migration table must not keep the deleted legacy APP user-demand startup blueprint path.");

for (const token of [
  "renderAppShell",
  "data-app-shell",
  "renderCommandBar",
  "renderSidebar",
  "renderMainWorkspace",
  "renderInspector",
  "renderRuntimeConsole",
]) {
  assert(appShell.includes(token) || home.includes(token), `App Shell entry must include ${token}.`);
}

for (const token of [
  "command-bar",
  "sidebar",
  "workspace",
  "inspector",
  "runtime-console",
  "panel",
  "card",
  "history-table",
  "filter-bar",
  "status-badge",
  "decision-badge",
  "detail-section",
  "empty-state",
  "loading-state",
  "error-state",
  "manual-required-state",
  "failed-state",
  "status-pass",
  "status-watch",
  "status-reject",
  "status-insufficient",
  "status-running",
  "status-completed",
  "status-completed-with-errors",
  "status-manual-required",
  "status-failed",
]) {
  assert(styles.includes(token), `App Shell styles must define ${token}.`);
}

assert(sidebar.includes("skillRegistry"), "Sidebar must render from Skill Registry.");
assert(layout.includes("data-skill-workspace"), "Main workspace must render Level 2 skill workspaces.");
assert(layout.includes("data-workspace-page-nav"), "Secondary skills must expose Level 2 page navigation instead of single form pages.");
assert(layout.includes('data-workspace-page="download"'), "Amazon invoice workspace must expose a Download page tab.");
assert(layout.includes('data-workspace-page="upload"'), "Amazon invoice workspace must keep the Upload page tab.");
assert(layout.includes('data-workspace-page="latest"'), "Amazon invoice workspace must keep the Latest page tab.");
assert(layout.includes('data-workspace-page="evidence"'), "Amazon invoice workspace must keep the Evidence page tab.");
assert(layout.includes("data-amazon-tax-invoice-download-form"), "Amazon invoice workspace must expose the tax invoice CSV Download surface.");
assert(layout.includes("Start Download"), "Amazon invoice Download surface must expose Start Download.");
assert(layout.includes("Latest Download"), "Amazon invoice Download surface must expose Latest Download.");
assert(layout.includes("Open Artifact"), "Amazon invoice Download surface must expose Open Artifact.");
for (const forbiddenDownloadField of ["selector", "actionPlan", "browserCommand", "documentId", "browserProfileDirectory"]) {
  assert(!layout.includes(`name="${forbiddenDownloadField}"`), `Amazon invoice Download surface must not expose ${forbiddenDownloadField}.`);
}
assert(inspector.includes("data-app-shell-inspector"), "Right Inspector must exist.");
assert(inspector.includes("empty-state"), "Right Inspector must expose empty state.");
assert(runtimeConsole.includes("data-runtime-console"), "Bottom Runtime Console must exist.");
assert(runtimeConsole.includes("manual-required-state"), "Runtime Console must expose manual_required state.");
assert(runtimeConsole.includes("failed-state"), "Runtime Console must expose failed state.");
assert(client.includes("openInspector"), "Client must support Level 3 detail Inspector.");
assert(client.includes('document.body.classList.remove("inspector-collapsed")'), "Opening Level 3 detail must expand the Inspector.");
assert(client.includes("resetInspectorForSkill"), "Skill switching must clear stale Inspector detail.");
assert(appShell.includes('class="inspector-collapsed"'), "Inspector must be closed by default so Main Workspace owns the screen until detail is selected.");
assert(!client.includes('openInspector({ kind: "task", title: recordId, payload: record });'), "Task polling and latest refresh must not force-open the right Inspector.");
assert(client.includes("showWorkspacePage"), "Secondary skills must switch Level 2 workspace pages.");
assert(client.includes("data-amazon-tax-invoice-download-form"), "Client must bind the Amazon tax invoice download form submit.");
assert(client.includes("startAmazonTaxInvoiceDownload"), "Client must expose the Amazon tax invoice download start handler.");
assert(client.includes("/api/plugins/amazon-invoice-upload/download/start"), "Client must call the Amazon tax invoice download start route.");
assert(client.includes("data-amazon-tax-invoice-download-latest"), "Client must bind Latest Download.");
assert(client.includes("/api/plugins/amazon-invoice-upload/download/latest"), "Client must call the Amazon tax invoice download latest route.");
assert(client.includes("data-amazon-tax-invoice-download-artifact"), "Client must bind Open Artifact.");
assert(client.includes("/api/plugins/amazon-invoice-upload/download/artifact/"), "Client must call the Amazon tax invoice download artifact route.");

process.stdout.write("[ACCEPTANCE][app-shell-ui] PASS\n");
