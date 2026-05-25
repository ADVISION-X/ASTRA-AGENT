import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const packageJson = readFileSync("package.json", "utf8");
const ciFull = readFileSync("scripts/audit/ci-full.ts", "utf8");
const routes = readFileSync("src/app/workbench-deep-research-routes.ts", "utf8");
const reportView = readFileSync("src/app/workbench-deep-research-report-view.ts", "utf8");
const handle = readFileSync("src/lib/local-runtime/workbench-handle.ts", "utf8");
const publicFacade = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.public.ts", "utf8");

const deletedFiles = [
  "src/plugins/deep-research-analysis/deep-research-analysis.html-report-reentry.ts",
  "scripts/acceptance/deep-research-raw-response-sovereignty.acceptance.ts",
  "scripts/acceptance/deep-research-final-adjudication-full-input.acceptance.ts",
  "scripts/acceptance/deep-research-report-export.acceptance.ts",
  "scripts/acceptance/deep-research-app-ui.acceptance.ts",
] as const;

for (const filePath of deletedFiles) {
  assert(!existsSync(filePath), `${filePath} must be physically deleted.`);
}

for (const marker of [
  "acceptance:deep-research-raw-response-sovereignty",
  "acceptance:deep-research-final-adjudication-full-input",
  "acceptance:deep-research-report-export",
  "acceptance:deep-research-app-ui",
]) {
  assert(!packageJson.includes(marker), `package.json must not contain ${marker}.`);
  assert(!ciFull.includes(marker), `ci:full must not contain ${marker}.`);
}

assert(!routes.includes("/api/deep-research-analysis/regenerate-html-report"), "HTML regenerate route must be deleted.");
assert(!handle.includes("rerunDeepResearchBusinessHtmlReport"), "Workbench handle must not expose HTML reentry.");
assert(!publicFacade.includes("rerunDeepResearchBusinessHtmlReport"), "Public facade must not expose HTML reentry.");
assert(!reportView.includes("data-deep-research-decomposition"), "Report view must not expose a standalone decomposition section.");
assert(!reportView.includes("data-deep-research-final-adjudication"), "Report view must not expose a standalone final-adjudication section.");
assert(!reportView.includes("data-deep-research-evidence"), "Report view must not expose a standalone evidence section.");
assert(reportView.includes("data-deep-research-process-trace"), "Report view must expose the process-trace section.");

process.stdout.write("[ACCEPTANCE][deep-research-no-old-modes] PASS\n");