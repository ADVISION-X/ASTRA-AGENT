import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const reportView = readFileSync("src/app/workbench-deep-research-report-view.ts", "utf8");
const contracts = readFileSync("src/app/workbench-deep-research-client-contracts.ts", "utf8");
const clientShared = readFileSync("src/app/workbench-deep-research-client-shared.ts", "utf8");
const deliverySections = readFileSync("src/app/workbench-deep-research-client-delivery-sections.ts", "utf8");

assert(reportView.includes("data-deep-research-final-card"), "Report view must expose the final raw section.");
assert(reportView.includes("data-deep-research-primary-business-report"), "Report view must expose the primary business HTML report section.");
assert(reportView.includes("data-deep-research-research-plan"), "Report view must expose the ResearchPlan section.");
assert(reportView.includes("data-deep-research-analysis-cards"), "Report view must expose the analysis cards section.");
assert(reportView.includes("data-deep-research-full-case-file"), "Report view must expose the full case file section.");
assert(reportView.includes("data-deep-research-process-trace"), "Report view must expose the process-trace section.");

assert(contracts.includes("promptBundle:"), "Client contracts must expose promptBundle.");
assert(contracts.includes("researchPlan:"), "Client contracts must expose researchPlan.");
assert(clientShared.includes("renderPromptBundleDetails"), "Shared runtime must expose renderPromptBundleDetails.");
assert(clientShared.includes("Clean Answer"), "Shared runtime must expose Clean Answer label.");
assert(clientShared.includes("Raw AI Response"), "Shared runtime must expose Raw AI Response label.");
assert(clientShared.includes("Index JSON"), "Shared runtime must expose Index JSON label.");
assert(!clientShared.includes('renderExpandableText("Summary", block.answerText'), "answerText must not be labeled as Summary.");

assert(deliverySections.includes("sourceKind"), "Delivery sections must expose sourceKind.");
assert(deliverySections.includes("fileHash"), "Delivery sections must expose fileHash.");
assert(deliverySections.includes("fileSizeBytes"), "Delivery sections must expose fileSizeBytes.");
assert(deliverySections.includes("failureReason") || deliverySections.includes("reviewReason"), "Delivery sections must expose failureReason or reviewReason.");

for (const forbidden of [
  decode("cHB0"),
  decode("ZGVjaw=="),
  decode("YnVzaW5lc3MtZGVjaw=="),
  decode("T3B0aW9uYWwgUHJlc2VudGF0aW9uIERlY2s="),
  decode("T3BlbiBQUFQ="),
  decode("RG93bmxvYWQgUFBU"),
]) {
  assert(!reportView.toLowerCase().includes(forbidden.toLowerCase()), "Report view must not expose forbidden final-presentation vocabulary.");
  assert(!deliverySections.toLowerCase().includes(forbidden.toLowerCase()), "Delivery sections must not expose forbidden final-presentation vocabulary.");
}

process.stdout.write("[ACCEPTANCE][deep-research-app-ui] PASS\n");