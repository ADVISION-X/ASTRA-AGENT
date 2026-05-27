import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const exportFile = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts", "utf8");
const contracts = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.records.ts", "utf8");
const delivery = readFileSync("src/app/workbench-deep-research-client-delivery-sections.ts", "utf8");
const routes = readFileSync("src/app/workbench-deep-research-routes.ts", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const ciFull = readFileSync("scripts/audit/ci-full.ts", "utf8");
const ciFullPhasePlan = readFileSync("scripts/audit/ci-full-phase-plan.ts", "utf8");

assert(exportFile.includes("business-report.html"), "business-report.html export is required.");
assert(contracts.includes("business-report.html"), "business-report.html must be an export kind.");
assert(!contracts.includes(decode("LnBwdA==")), "Previous presentation export kinds must not exist.");
assert(!delivery.includes(decode("T3BlbiBQUFQ=")), "UI must not expose previous presentation open action.");
assert(!delivery.includes(decode("RG93bmxvYWQgUFBU")), "UI must not expose previous presentation download action.");
assert(!delivery.includes("Regenerate HTML Report"), "UI must not expose HTML regenerate actions.");
assert(!delivery.includes("data-deep-research-regenerate-html"), "UI must not expose HTML regenerate controls.");
assert(!routes.includes("/api/deep-research-analysis/regenerate-html-report"), "Routes must not expose HTML regenerate endpoints.");
assert(!existsSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-reentry.ts"), "HTML re-entry owner must be deleted.");
assert(packageJson.includes("acceptance:deep-research-html-report-only"), "package.json must wire the HTML-report-only acceptance.");
assert(ciFull.includes("acceptanceSteps"), "ci:full must source acceptance execution from the phase plan.");
assert(ciFullPhasePlan.includes("acceptance:deep-research-html-report-only"), "ci:full phase plan must execute the HTML-report-only acceptance.");

process.stdout.write("[ACCEPTANCE][deep-research-html-report-only] PASS\n");
