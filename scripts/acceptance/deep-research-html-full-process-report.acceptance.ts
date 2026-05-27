import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS,
  parseAndPersistBusinessHtmlReport,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.js";

const promptShell = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts", "utf8");
const htmlStage = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const ciFull = readFileSync("scripts/audit/ci-full.ts", "utf8");

for (const sectionId of DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS) {
  assert(promptShell.includes(sectionId), `HTML prompt shell must require ${sectionId}.`);
  assert(htmlStage.includes(sectionId), `HTML parser must validate ${sectionId}.`);
}

for (const marker of [
  "full-process case report",
  "forensics-process section",
  "n-stage-questions-and-answers",
  "raw-preserved parse failures",
]) {
  assert(promptShell.includes(marker), `HTML prompt shell must contain ${marker}.`);
}

assert(htmlStage.includes("hasRequiredBusinessHtmlReviewSections"), "HTML parser must enforce full-process review sections.");
assert(packageJson.includes("acceptance:deep-research-html-full-process-report"), "package.json must wire full-process HTML acceptance.");
assert(ciFull.includes("acceptance:deep-research-html-full-process-report"), "ci:full must execute full-process HTML acceptance.");

const buildHtml = (body: string): string => [
  "<!DOCTYPE html>",
  "<html>",
  "<head><meta charset=\"utf-8\"><title>Deep Research Report</title><style>body{font-family:sans-serif;}</style></head>",
  `<body><main>${body}</main></body>`,
  "</html>",
].join("");

const oneVoiceHtml = buildHtml("<h1>One Voice Report</h1><p>Only the final answer appears here.</p>");
const invalidResult = parseAndPersistBusinessHtmlReport({
  rawText: oneVoiceHtml,
  outputPath: path.join(mkdtempSync(path.join(tmpdir(), "grasseye-html-full-process-invalid-")), "business-report.html"),
});
if (invalidResult.parsed !== null) {
  throw new Error("One-voice HTML must not persist as a business report.");
}
assert.equal(invalidResult.reason, "business_html_document_missing", "Missing full-process sections must use the HTML document failure reason.");

const validHtml = buildHtml([
  "<section id=\"summary-answer\"><h2>Summary Answer</h2><p>Quick answer.</p></section>",
  "<section id=\"forensics-process\"><h2>Forensics Process</h2><p>Decomposition, N-stage analysis, final adjudication, and export refs are visible.</p></section>",
  "<section id=\"business-conclusion\"><h2>Final Conclusion</h2><p>Conclusion preserves the final adjudication meaning.</p></section>",
  "<section id=\"n-stage-questions-and-answers\"><h2>N-stage Questions and Answers</h2><article><h3>Q1</h3><p>Question text and answer material.</p></article></section>",
].join(""));
const validResult = parseAndPersistBusinessHtmlReport({
  rawText: validHtml,
  outputPath: path.join(mkdtempSync(path.join(tmpdir(), "grasseye-html-full-process-valid-")), "business-report.html"),
});
if (validResult.parsed === null) {
  throw new Error("Full-process HTML must return a parsed business report record.");
}
assert.equal(validResult.parseStatus, "parsed", "Full-process HTML must persist.");
assert.equal(validResult.parsed.exportKind, "business-report.html", "Parsed report must remain the primary business HTML artifact.");

process.stdout.write("[ACCEPTANCE][deep-research-html-full-process-report] PASS\n");
