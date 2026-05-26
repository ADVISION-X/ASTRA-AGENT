import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const answerPersist = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.analysis-sub-questions.ts", "utf8");
const publicContracts = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.public-contracts.ts", "utf8");
const publicReportSupport = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.public-report-support.ts", "utf8");
const clientContracts = readFileSync("src/app/workbench-deep-research-client-contracts.ts", "utf8");
const clientShared = readFileSync("src/app/workbench-deep-research-client-shared.ts", "utf8");
const clientReportSections = readFileSync("src/app/workbench-deep-research-client-report-sections.ts", "utf8");

assert(!answerPersist.includes("confidence:"), "Answer persistence must not synthesize confidence.");
assert(!publicContracts.includes("confidence:"), "Public Deep Research contracts must not expose confidence.");
assert(!publicReportSupport.includes("confidence"), "Public report support must not compute confidence.");
assert(!clientContracts.includes("finalConfidence"), "Client contracts must not retain the retired finalConfidence field.");
assert(!clientShared.includes("renderConfidenceBadge"), "Client shared helpers must not render confidence badges.");
assert(!clientShared.includes("research-confidence-pill"), "Client shared helpers must not use confidence-pill UI.");
assert(!clientReportSections.includes("renderConfidenceBadge"), "Client report sections must not render confidence badges.");

process.stdout.write("[ACCEPTANCE][deep-research-no-system-confidence] PASS\n");
