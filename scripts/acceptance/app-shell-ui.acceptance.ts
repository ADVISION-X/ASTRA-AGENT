import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path: string): string => readFileSync(path, "utf8");

const appShell = read("src/app/app-shell/app-shell.ts");
const sidebar = read("src/app/app-shell/sidebar.ts");
const layout = [
  "src/app/app-shell/app-shell-layout.ts",
  "src/app/app-shell/amazon-invoice-workspace.ts",
].map(read).join("\n");
const amazonInvoiceWorkspace = read("src/app/app-shell/amazon-invoice-workspace.ts");
const batchSurface = amazonInvoiceWorkspace.slice(
  amazonInvoiceWorkspace.indexOf("const renderAmazonInvoiceBatchSurface"),
  amazonInvoiceWorkspace.indexOf("const renderAmazonInvoiceLedgerSurface"),
);
const inspector = read("src/app/app-shell/inspector.ts");
const runtimeConsole = read("src/app/app-shell/runtime-console.ts");
const styles = [
  "src/app/app-shell/app-shell-styles.ts",
  "src/app/app-shell/app-shell-core-styles.ts",
  "src/app/app-shell/app-shell-workspace-styles.ts",
  "src/app/app-shell/app-shell-inspector-console-styles.ts",
].map(read).join("\n");
const home = read("src/app/workbench-home-page.ts");
const client = [
  "src/app/workbench-home-client.ts",
  "src/app/workbench-home-amazon-invoice-client.ts",
].map(read).join("\n");
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
assert(layout.includes('data-workspace-page="batch"'), "Amazon invoice workspace must expose a Batch Upload page tab.");
assert(layout.includes('data-workspace-page="ledger"'), "Amazon invoice workspace must expose a Ledger page tab.");
assert(layout.includes('data-workspace-page="latest"'), "Amazon invoice workspace must keep the Latest page tab.");
assert(layout.includes('data-workspace-page="evidence"'), "Amazon invoice workspace must keep the Evidence page tab.");
assert(layout.includes("data-amazon-tax-invoice-download-form"), "Amazon invoice workspace must expose the tax invoice CSV Download surface.");
assert(layout.includes("Start Download"), "Amazon invoice Download surface must expose Start Download.");
assert(layout.includes("Latest Download"), "Amazon invoice Download surface must expose Latest Download.");
assert(layout.includes("Open Artifact"), "Amazon invoice Download surface must expose Open Artifact.");
assert(layout.includes("data-amazon-invoice-batch-form"), "Amazon invoice workspace must expose the batch upload form.");
assert(layout.includes('name="invoicePdfs" type="file"'), "Batch Upload must expose a PDF file selector.");
assert(layout.includes("multiple required"), "Batch Upload PDF selector must allow multiple files.");
assert(layout.includes("Start Batch Upload"), "Batch Upload must expose Start Batch Upload.");
assert(layout.includes("data-amazon-invoice-batch-history-list"), "Ledger page must expose a batch history list.");
assert(layout.includes("data-amazon-invoice-upload-ledger-list"), "Ledger page must expose the persisted upload ledger list.");
assert(layout.includes("data-amazon-invoice-upload-ledger-refresh"), "Ledger page must expose upload ledger refresh.");
assert(!batchSurface.includes("sellerCentralEntryUrl"), "Batch Upload must not expose Seller Central Entry URL as a user input.");
assert(!layout.includes("Safe Review Mode"), "Amazon invoice upload must not expose a human final-submit mode.");
assert(!layout.includes("requireHumanFinalSubmit"), "Amazon invoice upload must not hide a human final-submit compatibility field.");
assert(!layout.includes("require human final submit"), "Amazon invoice upload must not expose a human final-submit checkbox.");
assert(!layout.includes("stopOnManualRequired"), "Amazon invoice batch upload must not expose a manual stop switch.");
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
assert(client.includes("startAmazonInvoiceBatch"), "Client must expose the Amazon invoice batch start handler.");
assert(client.includes("data-amazon-invoice-batch-form"), "Client must bind the Amazon invoice batch form submit.");
assert(client.includes("/api/plugins/amazon-invoice-upload/batch/start"), "Client must call the Amazon invoice batch start route.");
assert(client.includes("Local file queue"), "Client must turn large local file selections into a visible queue.");
assert(client.includes("/api/plugins/amazon-invoice-upload/start"), "Client local batch queue must reuse the existing single upload route per file.");
assert(!client.includes('body.append("invoicePdfs"'), "Client must not upload all selected PDFs in one multipart request.");
assert(client.includes("/api/plugins/amazon-invoice-upload/batch/history"), "Client must call the Amazon invoice batch history route.");
assert(client.includes("/api/plugins/amazon-invoice-upload/batch/status/"), "Client must poll the Amazon invoice batch status route.");
assert(client.includes("refreshAmazonInvoiceUploadLedger"), "Client must render the persisted upload ledger.");
assert(client.includes("/api/plugins/amazon-invoice-upload/ledger"), "Client must call the Amazon invoice upload ledger route.");
assert(client.includes("amazonInvoiceBatchSellerCentralEntryUrl"), "Batch client must derive Seller Central Entry URL from marketplace.");
assert(!client.includes("requireHumanFinalSubmit"), "Amazon invoice client must not send a human final-submit compatibility field.");
assert(!client.includes("form.requireHumanFinalSubmit"), "Amazon invoice client must not read a human final-submit UI choice.");
assert(!client.includes("stopOnManualRequired"), "Amazon invoice client must not send a manual stop switch.");
for (const forbiddenBatchField of ["selector", "actionPlan", "browserCommand", "documentId", "cookie", "browserProfileDirectory"]) {
  assert(!layout.includes(`name="${forbiddenBatchField}"`), `Amazon invoice Batch UI must not expose ${forbiddenBatchField}.`);
}

process.stdout.write("[ACCEPTANCE][app-shell-ui] PASS\n");
