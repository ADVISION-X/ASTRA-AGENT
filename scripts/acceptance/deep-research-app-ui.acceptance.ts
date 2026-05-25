import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const routes = readFileSync("src/app/workbench-deep-research-routes.ts", "utf8");
const reportView = readFileSync("src/app/workbench-deep-research-report-view.ts", "utf8");
const handle = readFileSync("src/lib/local-runtime/workbench-handle.ts", "utf8");
const publicFacade = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.public.ts", "utf8");
const clientShared = readFileSync("src/app/workbench-deep-research-client-shared.ts", "utf8");
const deliverySections = readFileSync("src/app/workbench-deep-research-client-delivery-sections.ts", "utf8");

assert(!routes.includes("/api/deep-research-analysis/regenerate-html-report"), "HTML regenerate route must be deleted.");
assert(!handle.includes("rerunDeepResearchBusinessHtmlReport"), "Workbench handle must not expose HTML reentry.");
assert(!publicFacade.includes("rerunDeepResearchBusinessHtmlReport"), "Public facade must not expose HTML reentry.");
assert(reportView.includes("data-deep-research-final-card"), "Report view must expose the final adjudication section.");
assert(reportView.includes("data-deep-research-primary-business-report"), "Report view must expose the primary business HTML report section.");
assert(reportView.includes("data-deep-research-full-case-file"), "Report view must expose the full case file section.");
assert(reportView.includes("data-deep-research-process-trace"), "Report view must expose the process-trace section.");
assert(deliverySections.includes("Open HTML Report"), "Client delivery actions must expose Open HTML Report.");
assert(deliverySections.includes("Download HTML Report"), "Client delivery actions must expose Download HTML Report.");
assert(deliverySections.includes("Open Full Case File"), "Client delivery actions must expose Open Full Case File.");
assert(deliverySections.includes("Download full-case-file.md"), "Client delivery actions must expose Download full-case-file.md.");
assert(deliverySections.includes("Download full-case-file.json"), "Client delivery actions must expose Download full-case-file.json.");
assert(clientShared.includes("structured-index.json"), "Client shared export actions must support structured-index.json.");
for (const forbidden of [
  decode("cHB0"),
  decode("ZGVjaw=="),
  decode("YnVzaW5lc3MtZGVjaw=="),
  decode("ZGVja091dGxpbmU="),
  decode("Y29tcGFjdA=="),
]) {
  assert(!reportView.toLowerCase().includes(forbidden), `Report view must not expose ${forbidden}.`);
  assert(!deliverySections.toLowerCase().includes(forbidden), `Delivery actions must not expose ${forbidden}.`);
}

process.stdout.write("[ACCEPTANCE][deep-research-app-ui] PASS\n");