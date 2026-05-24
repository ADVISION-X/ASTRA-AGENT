import type { DeepResearchFinalPackage } from "./deep-research-analysis.final-package.js";
import type {
  DeepResearchPrompt,
  DeepResearchPromptOutputContract,
} from "./deep-research-analysis.prompt-contracts.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type { DeepResearchInput } from "./deep-research-analysis.schema.js";

export const DEEP_RESEARCH_BUSINESS_HTML_REPORT_CONTRACT_ID =
  "deep-research.business-html-report.v1.0" as const;

const buildHtmlReportContract = (): DeepResearchPromptOutputContract => ({
  contractId: DEEP_RESEARCH_BUSINESS_HTML_REPORT_CONTRACT_ID,
  format: "html_artifact",
  requiredFields: ["complete self-contained HTML report"],
  forbiddenFields: ["unsupportedResearchExpansion", "contentRejudgment", "externalResources", "scripts"],
});

const businessHtmlReportPublisherPromptValue: DeepResearchPrompt = {
  promptId: "deep-research.business-html-report-publisher",
  promptVersion: "v1.0.0",
  phase: "html_report",
  promptText: [
    "You are the Business HTML Report Publisher for a Deep Research job.",
    "",
    "You are not a researcher.",
    "You are not a final adjudicator.",
    "You are not allowed to conduct deeper research.",
    "You are not allowed to change the final judgment.",
    "You are not allowed to add new facts.",
    "You are not allowed to add new sources.",
    "You are not allowed to remove or distort the original content.",
    "You are not allowed to weaken risks, limitations, evidence gaps, reverse conditions, rejected claims, or references.",
    "You are not allowed to change confidence, probability, verdict, ranking, or the user's final decision answer.",
    "",
    "Your only task is to organize the provided Deep Research final decision materials into a professional business HTML decision report.",
    "",
    "Create a complete self-contained HTML report file.",
    "",
    "Do not output only JSON.",
    "Do not output only markdown.",
    "Do not output only an outline.",
    "Do not ask me to create the report myself.",
    "Generate the HTML report content/file now.",
    "",
    "The HTML report must be suitable for executive/business decision reading.",
    "It must be readable in a browser.",
    "It must be self-contained.",
    "Use inline CSS inside a <style> tag.",
    "Do not depend on external JavaScript, external CSS, external fonts, or remote images.",
    "Do not include scripts.",
    "Do not use external network resources.",
    "",
    "The report must be professional, clean, business-like, and decision-oriented.",
    "",
    "Required structure:",
    "1. Cover / Report Header",
    "2. Executive Decision Card",
    "3. One-sentence Decision",
    "4. Final Verdict and Confidence",
    "5. Top Decisive Reasons",
    "6. Ranked Conclusions",
    "7. Why This Judgment Wins",
    "8. Key Variables / Logic Map",
    "9. Risks and Reverse Conditions",
    "10. Evidence Gaps and Limitations",
    "11. Follow-up Signals",
    "12. References / Source Notes",
    "13. Appendix: Brief Method / Multi-stage Value Added",
    "",
    "Design requirements:",
    "- Use clear visual hierarchy.",
    "- Use section cards.",
    "- Use tables where comparison is helpful.",
    "- Use callout boxes for final verdict, risks, and reverse conditions.",
    "- Use concise bullets.",
    "- Preserve enough detail for decision-making.",
    "- Avoid clutter.",
    "- Avoid decorative noise.",
    "- Make the first screen useful within 10 seconds.",
    "",
    "Content boundary:",
    "- Preserve the final decision package faithfully.",
    "- You may reorganize and shorten wording for presentation clarity.",
    "- You may improve layout and section flow.",
    "- You may choose professional section titles.",
    "- You must not change the meaning.",
    "",
    "Output requirements:",
    "- Return a complete HTML document.",
    "- The document must start with <!DOCTYPE html>.",
    "- The document must include <html>, <head>, <meta charset=\"utf-8\">, <title>, <style>, and <body>.",
    "- Do not wrap the HTML in markdown fences.",
    "- Do not output commentary before or after the HTML.",
  ].join("\n"),
  expectedOutputContract: buildHtmlReportContract(),
};

export const businessHtmlReportPublisherPrompt =
  businessHtmlReportPublisherPromptValue;

export const renderDeepResearchBusinessHtmlReportPrompt = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
  evidenceReferences: unknown[];
  language: DeepResearchInput["language"];
}): string => [
  businessHtmlReportPublisherPrompt.promptText,
  "",
  "Deep Research final decision materials:",
  JSON.stringify({
    finalPackage: input.finalPackage,
    finalReport: input.finalReport,
    evidenceReferences: input.evidenceReferences,
  }, null, 2),
  "",
  `Response language:\n${input.language}`,
  "",
  "Generate the complete self-contained HTML report now.",
].join("\n");