import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const htmlStage = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts", "utf8");
const htmlPrompt = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.prompts.ts", "utf8");
const promptRender = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts", "utf8");

assert(htmlPrompt.includes("Runtime shell for AI-generated htmlReportPromptBundle."), "HTML report prompt must remain a runtime shell.");
assert(htmlPrompt.includes("htmlReportPromptBundle: DeepResearchPromptBundle"), "HTML report renderer must require an AI-generated htmlReportPromptBundle.");
assert(htmlStage.includes("htmlReportPromptBundle: input.fullCaseFile.researchPlan.htmlReportPromptBundle"), "HTML report stage must consume the AI-generated htmlReportPromptBundle.");
assert(htmlStage.includes("finalAdjudication: input.finalAdjudication"), "HTML report stage must pass the raw final adjudication into the HTML prompt renderer.");
assert(htmlStage.includes("fullCaseFileMarkdown: input.fullCaseFileMarkdown"), "HTML report stage must pass fullCaseFileMarkdown into the HTML prompt renderer.");
assert(htmlStage.includes("renderDeepResearchBusinessHtmlReportPrompt"), "HTML report stage must render through the HTML prompt shell.");
assert(htmlPrompt.includes("rawFinalAnswerText: input.finalAdjudication.rawFinalAnswerText"), "HTML prompt renderer must pass rawFinalAnswerText into the prompt bundle renderer.");
assert(promptRender.includes("FULL CASE FILE MARKDOWN"), "HTML report rendering must include fullCaseFileMarkdown.");
assert(promptRender.includes("FINAL ADJUDICATION RAW"), "HTML report rendering must include the raw final adjudication body.");
assert(promptRender.includes("Organize the HTML as a professional report according to the promptBundle."), "HTML report rendering must follow the AI-generated promptBundle.");
assert(promptRender.includes("forensics-process"), "HTML report rendering must require the forensics process section.");
assert(promptRender.includes("n-stage-questions-and-answers"), "HTML report rendering must require the N-stage questions and answers section.");

process.stdout.write("[ACCEPTANCE][deep-research-html-promptbundle-input] PASS\n");
