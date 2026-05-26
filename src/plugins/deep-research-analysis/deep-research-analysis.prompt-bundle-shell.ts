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
  renderForbiddenControlFieldNotice(),
].join("\n");
