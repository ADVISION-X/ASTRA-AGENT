import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const reportView = readFileSync("src/app/workbench-deep-research-report-view.ts", "utf8");
const panelView = readFileSync("src/app/workbench-deep-research-panel.ts", "utf8");
const contracts = readFileSync("src/app/workbench-deep-research-client-contracts.ts", "utf8");
const bootClient = readFileSync("src/app/workbench-deep-research-client-boot.ts", "utf8");
const clientShared = readFileSync("src/app/workbench-deep-research-client-shared.ts", "utf8");
const deliverySections = readFileSync("src/app/workbench-deep-research-client-delivery-sections.ts", "utf8");

assert(reportView.includes("data-deep-research-final-card"), "Report view must expose the final raw section.");
assert(reportView.includes("data-deep-research-primary-business-report"), "Report view must expose the primary business HTML report section.");
assert(reportView.includes("data-deep-research-research-plan"), "Report view must expose the ResearchPlan section.");
assert(reportView.includes("data-deep-research-analysis-cards"), "Report view must expose the analysis cards section.");
assert(reportView.includes("data-deep-research-full-case-file"), "Report view must expose the full case file section.");
assert(reportView.includes("data-deep-research-process-trace"), "Report view must expose the process-trace section.");
assert(panelView.includes("data-deep-research-page-nav"), "Deep Research must expose Level 2 page navigation.");
assert(panelView.includes('data-deep-research-page="reader"'), "Deep Research must expose Report Reader as a Level 2 page.");
assert(panelView.includes('data-deep-research-page="library"'), "Deep Research must expose Report Library as a Level 2 page.");
assert(panelView.includes('data-deep-research-page="new"'), "Deep Research must expose New Research as a Level 2 page.");
assert(panelView.includes('data-deep-research-page="case"'), "Deep Research must expose Case File as a Level 2 page.");
assert(panelView.includes('data-deep-research-surface="reader"'), "Deep Research must render a reader surface.");
assert(panelView.includes('data-deep-research-surface="library"'), "Deep Research must render a library surface.");
assert(panelView.includes('data-deep-research-surface="new"'), "Deep Research must render a new research surface.");
assert(panelView.includes('data-deep-research-surface="case"'), "Deep Research must render a case file surface.");
assert(panelView.indexOf('data-deep-research-surface="reader"') < panelView.indexOf('data-deep-research-surface="library"'), "Report Reader must be the default Deep Research surface before Library.");
assert(panelView.includes('class="skill-page-surface research-library-surface hidden"'), "Report Library must be hidden by default.");
assert(panelView.includes('class="skill-page-surface research-new-surface hidden"'), "New Research must be hidden by default.");
assert(panelView.includes('class="skill-page-surface research-case-surface hidden"'), "Case File must be hidden by default.");
assert(bootClient.includes("showDeepResearchPage"), "Deep Research client must switch Level 2 page surfaces.");
assert(bootClient.includes("openDeepResearchInspector"), "Deep Research client must open selected reports in the global Inspector.");
assert(contracts.includes("openInspector?: boolean"), "Deep Research report loading must distinguish auto reader load from explicit Level 3 Inspector open.");
assert(bootClient.includes("shouldOpenDeepResearchInspector"), "Deep Research must not open the right Inspector automatically for the default reader.");

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

for (const fieldName of ["userQuestion", "analysisGoal", "language", "providerKind", "maxSubQuestions"]) {
  assert(panelView.includes(`data-deep-research-field-help="${fieldName}"`), `${fieldName} must have field help.`);
}
assert(panelView.includes("data-deep-research-help-modal"), "Deep Research form must include a field-help modal.");
assert(bootClient.includes("getFieldHelpContent"), "Deep Research client must define field help content.");
assert(bootClient.includes("openFieldHelp"), "Deep Research client must open field help.");
assert(bootClient.includes("data-deep-research-help-close"), "Deep Research client must close field help.");

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
