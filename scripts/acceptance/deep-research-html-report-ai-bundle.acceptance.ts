import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const htmlStage = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts", "utf8");
const htmlPrompt = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.ts", "utf8");
const promptRender = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-render.ts", "utf8");

assert(htmlPrompt.includes("Runtime shell for AI-generated htmlReportPromptBundle."), "HTML report prompt must remain a runtime shell.");
assert(htmlPrompt.includes("htmlReportPromptBundle: DeepResearchPromptBundle"), "HTML report renderer must require an AI-generated htmlReportPromptBundle.");
assert(htmlStage.includes("htmlReportPromptBundle: input.fullCaseFile.researchPlan.htmlReportPromptBundle"), "HTML report stage must consume the AI-generated htmlReportPromptBundle.");
assert(htmlStage.includes("renderDeepResearchBusinessHtmlReportPrompt"), "HTML report stage must render through the HTML prompt shell.");
assert(promptRender.includes("Organize the HTML as a professional report according to the promptBundle."), "HTML report rendering must follow the AI-generated promptBundle.");

process.stdout.write("[ACCEPTANCE][deep-research-html-report-ai-bundle] PASS\n");