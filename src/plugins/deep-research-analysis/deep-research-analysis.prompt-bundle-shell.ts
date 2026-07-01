import { z } from "zod";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file.js";
import type { DeepResearchInput, DeepResearchSubQuestion } from "./deep-research-analysis.schema.js";
import type { DeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";

export const DeepResearchPromptBundleRoleSchema = z.enum([
  "sub_question_analysis",
  "final_adjudication",
  "html_report_publisher",
]);

export const DeepResearchPromptBundleSchema = z.object({
  promptBundleId: z.string().trim().min(1),
  promptRole: DeepResearchPromptBundleRoleSchema,
  taskInstruction: z.string().trim().min(1),
  questionSpecificFocus: z.array(z.string().trim().min(1)).min(1),
  mustUseInputs: z.array(z.string().trim().min(1)).min(1),
  mustNotDo: z.array(z.string().trim().min(1)).default([]),
  evidenceOrReasoningNeeds: z.array(z.string().trim().min(1)).default([]),
  outputGuidance: z.object({
    preferredFormat: z.enum(["json_object", "structured_text", "html_document"]),
    requiredContent: z.array(z.string().trim().min(1)).default([]),
    supplementalContent: z.array(z.string().trim().min(1)).default([]),
    forbiddenContent: z.array(z.string().trim().min(1)).default([]),
  }).strict(),
  safetyBoundary: z.array(z.string().trim().min(1)).default([]),
  languageInstruction: z.string().trim().min(1),
}).strict();

export type DeepResearchPromptBundle = z.infer<typeof DeepResearchPromptBundleSchema>;

const DeepResearchPromptIdSchema = z.enum([
  "deep-research.decomposition",
  "deep-research.sub-question-analysis",
  "deep-research.final-adjudication",
  "deep-research.business-html-report-publisher",
]);

const DeepResearchPromptVersionSchema = z
  .string()
  .regex(/^v\d+\.\d+\.\d+$/u, "promptVersion must use semver-like vX.Y.Z format.");

const DeepResearchPromptPhaseSchema = z.enum([
  "decomposition",
  "analysis",
  "final_adjudication",
  "html_report",
]);

const DeepResearchPromptOutputContractSchema = z.object({
  contractId: z.string().trim().min(1),
  format: z.enum(["json_object", "structured_text", "html_artifact", "html_document"]),
  requiredFields: z.array(z.string().trim().min(1)).min(1),
  forbiddenFields: z.array(z.string().trim().min(1)).min(1),
}).strict();

const DeepResearchPromptSchema = z.object({
  promptId: DeepResearchPromptIdSchema,
  promptVersion: DeepResearchPromptVersionSchema,
  phase: DeepResearchPromptPhaseSchema,
  promptText: z.string().trim().min(1),
  expectedOutputContract: DeepResearchPromptOutputContractSchema,
}).strict();

export type DeepResearchPromptOutputContract = z.infer<typeof DeepResearchPromptOutputContractSchema>;
export type DeepResearchPrompt = z.infer<typeof DeepResearchPromptSchema>;

const FORBIDDEN_CONTROL_FIELDS = [
  "browserCommand",
  "selector",
  "coordinate",
  "workflow",
  "multiStepPlan",
  "runNext",
  "databaseCommand",
  "filePath",
  "followUpAction",
  "executionDirective",
] as const;

export const SUB_QUESTION_ANSWER_TEXT_BEGIN = "ANSWER_TEXT_BEGIN" as const;
export const SUB_QUESTION_ANSWER_TEXT_END = "ANSWER_TEXT_END" as const;
export const SUB_QUESTION_INDEX_JSON_BEGIN = "INDEX_JSON_BEGIN" as const;
export const SUB_QUESTION_INDEX_JSON_END = "INDEX_JSON_END" as const;

const renderForbiddenControlFieldNotice = (): string =>
  `Do not output browserCommand, selector, workflow, databaseCommand, nextAction, filePath, actionPlan, or these control fields: ${FORBIDDEN_CONTROL_FIELDS.join(", ")}.`;

export const buildResearchPlanFormatShell = (): string => [
  "RUNTIME RESEARCH PLAN FORMAT SHELL:",
  "Return one valid JSON object.",
  "The JSON must be directly parseable without markdown fences or commentary.",
  "The runtime will persist the raw response as the source record and parse the JSON as the execution contract.",
  renderForbiddenControlFieldNotice(),
].join("\n");

export const buildSubQuestionAnalysisFormatShell = (): string => [
  "RUNTIME FORMAT SHELL FOR DATABASE CAPTURE:",
  `Return one complete answer body between ${SUB_QUESTION_ANSWER_TEXT_BEGIN} and ${SUB_QUESTION_ANSWER_TEXT_END}.`,
  "Do not wrap the answer body in a JSON response envelope.",
  "Even if the AI-generated promptBundle mentions json_object, write the answer body as structured text and keep JSON only for the retrieval-only index block.",
  "You may use normal Markdown, paragraphs, lists, and reasoning inside the answer body.",
  `You may append one retrieval-only JSON object between ${SUB_QUESTION_INDEX_JSON_BEGIN} and ${SUB_QUESTION_INDEX_JSON_END}.`,
  "The index JSON is secondary navigation data only.",
  "The raw response will be persisted exactly as returned.",
  "The full raw response will be persisted as the sovereign record.",
  "Preserve analytical content even if formatting is imperfect.",
  "Do not sacrifice content to satisfy formatting.",
  "Do not output system operation instructions.",
  "Do not invent unavailable evidence.",
  renderForbiddenControlFieldNotice(),
  "Return using this structure:",
  SUB_QUESTION_ANSWER_TEXT_BEGIN,
  "Complete answer body. It may include paragraphs, lists, reasoning, and evidence notes.",
  SUB_QUESTION_ANSWER_TEXT_END,
  SUB_QUESTION_INDEX_JSON_BEGIN,
  JSON.stringify({
    indexNotes: [
      "Short retrieval/index marker only; not an adjudication.",
    ],
  }, null, 2),
  SUB_QUESTION_INDEX_JSON_END,
].join("\n");

export const buildFinalAdjudicationFormatShell = (): string => [
  "RUNTIME FINAL FORMAT SHELL:",
  "You may write in Markdown / structured text.",
  "Do not force JSON if it would harm the quality of the final answer.",
  "Even if the AI-generated promptBundle mentions json_object, the final adjudication must still be written as structured text; any machine-readable object is secondary only.",
  "The complete raw final answer is the authoritative final adjudication.",
  "The runtime will persist your response exactly as rawFinalAnswerText.",
  "If you include any structured headings, they are part of your answer, not a system schema.",
  renderForbiddenControlFieldNotice(),
].join("\n");

export const buildHtmlReportFormatShell = (): string => [
  "RUNTIME HTML FORMAT SHELL:",
  "Return one complete self-contained HTML document.",
  "Start with <!DOCTYPE html>.",
  "Include <html>, <head>, <meta charset=\"utf-8\">, <title>, <style>, and <body>.",
  "Use inline CSS only.",
  "Do not include scripts.",
  "Do not depend on external CSS, fonts, images, or network resources.",
  "Do not wrap the HTML in markdown fences.",
  "The artifact delivery name is business-report.html.",
  "Do not create, attach, upload, download, or link a separate file.",
  "Do not use a code interpreter, canvas, artifact workspace, or file attachment.",
  "Output the complete HTML document directly as the assistant message body so the runtime can capture and persist it as business-report.html.",
  "The HTML must be a full-process case report, not only a final answer page.",
  "The HTML must visibly include the current fullCaseFile.job.jobId so the artifact can be machine-bound to the case file.",
  "Use these exact section ids in this order: summary-answer, forensics-process, business-conclusion, n-stage-questions-and-answers.",
  "Immediately after the summary-answer section, include the forensics-process section that explains the evidence chain from the full case file.",
  "Place the business-conclusion section near the end of the main report body and before the N-stage appendix.",
  "After business-conclusion, include n-stage-questions-and-answers as a brief index with every persisted sub-question, its question text, parse status, raw-preserved state when structured answer is missing, and a 1-2 paragraph answer digest.",
  "For every persisted N-stage answer in n-stage-questions-and-answers, cite its raw response hash from fullCaseFileMarkdown.",
  "Do not paste the full persisted N-stage answer material yourself; the runtime will deterministically append the complete canonical N-stage evidence appendix from fullCaseFileMarkdown before persistence.",
  "The persisted final HTML must preserve at least 80 percent of the persisted N-stage answer material; this retention floor is enforced after the runtime appends the canonical N-stage evidence appendix.",
  "Use fullCaseFileMarkdown as the source for decomposition, prompt/response availability, parse status, final adjudication, evidence refs, and N-stage question-answer material.",
  "Do not hide raw-preserved parse failures; show that raw response exists and structured parsing failed.",
  renderForbiddenControlFieldNotice(),
].join("\n");

const buildSection = (title: string, value: unknown): string =>
  `${title}:\n${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`;

const renderPromptBundleSection = (promptBundle: DeepResearchPromptBundle): string =>
  buildSection("AI-GENERATED PROMPTBUNDLE", promptBundle);

export const renderSubQuestionAnalysisFromPromptBundle = (input: {
  userQuestion: string;
  analysisGoal: string | null;
  language: DeepResearchInput["language"];
  subQuestion: DeepResearchSubQuestion;
  promptBundle: DeepResearchPromptBundle;
}): string => [
  renderPromptBundleSection(input.promptBundle),
  buildSubQuestionAnalysisFormatShell(),
  buildSection("CONTEXT", {
    userQuestion: input.userQuestion,
    analysisGoal: input.analysisGoal,
    responseLanguage: input.language,
    subQuestion: input.subQuestion,
  }),
].join("\n\n");

export const renderFinalAdjudicationFromPromptBundle = (input: {
  language: DeepResearchInput["language"];
  finalAdjudicationPromptBundle: DeepResearchPromptBundle;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
  structuredIndex: DeepResearchStructuredIndex;
}): string => [
  renderPromptBundleSection(input.finalAdjudicationPromptBundle),
  "Use the full case file as the source of truth.",
  "The structured index is for navigation.",
  "If structured fields and raw responses differ, use the raw responses as primary evidence.",
  "Do not ignore raw responses.",
  "Do not ignore raw responses that failed parsing.",
  buildFinalAdjudicationFormatShell(),
  buildSection("CONTEXT", {
    responseLanguage: input.language,
    structuredIndex: input.structuredIndex,
    fullCaseFile: {
      caseFileVersion: input.fullCaseFile.caseFileVersion,
      job: input.fullCaseFile.job,
      coverage: input.fullCaseFile.coverage,
      failedButRawAvailableInteractionCount: input.fullCaseFile.failedButRawAvailableInteractions.length,
    },
  }),
  buildSection("FULL CASE FILE MARKDOWN", input.fullCaseFileMarkdown),
].join("\n\n");

export const renderHtmlReportFromPromptBundle = (input: {
  language: DeepResearchInput["language"];
  htmlReportPromptBundle: DeepResearchPromptBundle;
  rawFinalAnswerText: string;
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdown: string;
}): string => [
  renderPromptBundleSection(input.htmlReportPromptBundle),
  "Organize the HTML as a professional report according to the promptBundle.",
  buildHtmlReportFormatShell(),
  buildSection("CONTEXT", {
    responseLanguage: input.language,
    fullCaseFile: {
      caseFileVersion: input.fullCaseFile.caseFileVersion,
      job: input.fullCaseFile.job,
      coverage: input.fullCaseFile.coverage,
      failedButRawAvailableInteractionCount: input.fullCaseFile.failedButRawAvailableInteractions.length,
    },
  }),
  buildSection("FINAL ADJUDICATION RAW", input.rawFinalAnswerText),
  buildSection("FULL CASE FILE MARKDOWN", input.fullCaseFileMarkdown),
].join("\n\n");
