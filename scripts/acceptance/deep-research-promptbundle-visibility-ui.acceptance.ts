import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const contracts = readFileSync("src/app/workbench-deep-research-client-contracts.ts", "utf8");
const caseReader = readFileSync("src/app/workbench-deep-research-client-case-reader.ts", "utf8");

assert(contracts.includes("promptBundle:"), "Contracts must expose promptBundle on subQuestion.");
assert(contracts.includes("researchPlan:"), "Contracts must expose researchPlan.");
assert(caseReader.includes("renderPromptBundleDetails"), "Case reader renderer must expose renderPromptBundleDetails.");
assert(caseReader.includes("Final Adjudication PromptBundle"), "ResearchPlan section must expose final adjudication prompt bundle.");
assert(caseReader.includes("HTML Report PromptBundle"), "ResearchPlan section must expose HTML report prompt bundle.");

process.stdout.write("[ACCEPTANCE][deep-research-promptbundle-visibility-ui] PASS\n");