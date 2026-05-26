import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const reportView = readFileSync("src/app/workbench-deep-research-report-view.ts", "utf8");
const reportSections = readFileSync("src/app/workbench-deep-research-client-report-sections.ts", "utf8");

assert(reportView.includes("data-deep-research-research-plan"), "Report view must include ResearchPlan section.");
assert(reportView.includes("data-deep-research-analysis-cards"), "Report view must include Analysis Cards section.");
assert(reportSections.includes("renderResearchPlan"), "Report sections must render ResearchPlan.");
assert(reportSections.includes("renderAnalysisCards"), "Report sections must render Analysis Cards.");
assert(reportSections.includes("Final Adjudication Raw"), "Report navigation must expose Final Adjudication Raw.");
assert(reportSections.includes("Primary Business HTML Report"), "Report navigation must expose Primary Business HTML Report.");
assert(reportSections.includes("Process Trace"), "Report navigation must expose Process Trace.");

process.stdout.write("[ACCEPTANCE][deep-research-case-reader-ui] PASS\n");