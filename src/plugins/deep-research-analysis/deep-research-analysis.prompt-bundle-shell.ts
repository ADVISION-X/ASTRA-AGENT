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

export const renderDeepResearchRuntimeShell = (input: {
  preferredFormat: "json_object" | "structured_text" | "html_document";
  artifactName?: string;
}): string => [
  "RUNTIME SHELL:",
  "- Preserve analytical content even if formatting is imperfect.",
  "- The raw response will be persisted exactly as returned.",
  "- Return the requested format when possible.",
  `- Preferred format: ${input.preferredFormat}.`,
  "- Do not output system operation instructions.",
  `- Do not output these control fields: ${FORBIDDEN_CONTROL_FIELDS.join(", ")}.`,
  "- Do not invent unavailable evidence.",
  input.artifactName
    ? `- The artifact delivery name is ${input.artifactName}.`
    : null,
].filter((line): line is string => line !== null).join("\n");

export const renderDeepResearchHtmlArtifactShell = (): string => [
  renderDeepResearchRuntimeShell({
    preferredFormat: "html_document",
    artifactName: "business-report.html",
  }),
  "- Return one complete self-contained HTML document.",
  "- Use inline CSS only.",
  "- Do not include scripts.",
  "- Do not depend on external CSS, fonts, images, or network resources.",
  "- The document must include <!DOCTYPE html>, html, head, meta charset, title, style, and body.",
  "- Do not wrap the HTML in markdown fences.",
].join("\n");
