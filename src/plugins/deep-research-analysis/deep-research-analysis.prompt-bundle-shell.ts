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

const renderForbiddenControlFieldNotice = (): string =>
  `Do not output browserCommand, selector, workflow, databaseCommand, nextAction, filePath, actionPlan, or these control fields: ${FORBIDDEN_CONTROL_FIELDS.join(", ")}.`;

export const buildSubQuestionAnalysisFormatShell = (): string => [
  "RUNTIME FORMAT SHELL FOR DATABASE CAPTURE:",
  "Return the requested format when possible.",
  "Return the answer in the requested response envelope when possible.",
  "The response envelope is for database indexing only.",
  "The raw response will be persisted exactly as returned.",
  "The full raw response will be persisted as the sovereign record.",
  "Preserve analytical content even if formatting is imperfect.",
  "Do not sacrifice content to satisfy formatting.",
  "Do not output system operation instructions.",
  "Do not invent unavailable evidence.",
  renderForbiddenControlFieldNotice(),
  "Minimal response envelope:",
  JSON.stringify({
    answerText: "Complete answer body. It may include paragraphs, lists, reasoning, and evidence notes.",
    indexNotes: [
      "Short retrieval/index marker only; not an adjudication.",
    ],
    formatNotice: "answerText is the complete answer; runtime must preserve raw response.",
  }, null, 2),
].join("\n");

export const buildFinalAdjudicationFormatShell = (): string => [
  "RUNTIME FINAL FORMAT SHELL:",
  "You may write in Markdown / structured text.",
  "Do not force JSON if it would harm the quality of the final answer.",
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
