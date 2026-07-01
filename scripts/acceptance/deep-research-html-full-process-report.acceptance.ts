import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS,
  parseAndPersistBusinessHtmlReport,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.js";
import {
  createDeepResearchFullCaseFixture,
  disposeDeepResearchFullCaseFixture,
} from "./deep-research-full-case-file-support.js";

const promptShell = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.prompt-bundle-shell.ts", "utf8");
const htmlStage = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts", "utf8");
const analysisRunner = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const ciFull = readFileSync("scripts/audit/ci-full.ts", "utf8");
const ciFullPhasePlan = readFileSync("scripts/audit/ci-full-phase-plan.ts", "utf8");

for (const sectionId of DEEP_RESEARCH_BUSINESS_HTML_REQUIRED_SECTION_IDS) {
  assert(promptShell.includes(sectionId), `HTML prompt shell must require ${sectionId}.`);
  assert(htmlStage.includes(sectionId), `HTML parser must validate ${sectionId}.`);
}

for (const marker of [
  "full-process case report",
  "forensics-process section",
  "n-stage-questions-and-answers",
  "raw-preserved parse failures",
  "raw response hash",
  "80 percent",
  "Do not create, attach, upload, download, or link a separate file",
  "Output the complete HTML document directly as the assistant message body",
]) {
  assert(promptShell.includes(marker), `HTML prompt shell must contain ${marker}.`);
}

assert(htmlStage.includes("hasRequiredBusinessHtmlReviewSections"), "HTML parser must enforce full-process review sections.");
assert(htmlStage.includes("DEEP_RESEARCH_BUSINESS_HTML_N_STAGE_RETENTION_FLOOR"), "HTML parser must enforce the N-stage retention floor.");
assert(htmlStage.includes("readBusinessHtmlCaseFileFailure"), "HTML parser must validate case-file binding and N-stage citations.");
assert(htmlStage.includes("ensureCanonicalNStageRetentionAppendix"), "HTML parser must deterministically append canonical N-stage evidence.");
assert(htmlStage.includes("business_html_n_stage_citation_missing"), "Full-process HTML acceptance must assert business_html_n_stage_citation_missing.");
assert(htmlStage.includes("business_html_n_stage_retention_below_80"), "Full-process HTML acceptance must assert business_html_n_stage_retention_below_80.");
assert(analysisRunner.includes("Math.max(context.timeoutMs ?? 0, promptPackage.timeoutMs)"), "Prompt-specific HTML timeout must not be shortened by the runtime default.");
assert(packageJson.includes("acceptance:deep-research-html-full-process-report"), "package.json must wire full-process HTML acceptance.");
assert(ciFull.includes("acceptanceSteps"), "ci:full must source acceptance execution from the phase plan.");
assert(ciFullPhasePlan.includes("acceptance:deep-research-html-full-process-report"), "ci:full phase plan must execute full-process HTML acceptance.");

const buildHtml = (body: string): string => [
  "<!DOCTYPE html>",
  "<html>",
  "<head><meta charset=\"utf-8\"><title>Deep Research Report</title><style>body{font-family:sans-serif;}</style></head>",
  `<body><main>${body}</main></body>`,
  "</html>",
].join("");

const readNStageSourceText = (entry: ReturnType<typeof createDeepResearchFullCaseFixture>["fullCaseFile"]["subQuestionAnalyses"][number]): string =>
  typeof (entry.structuredAnswer as { answerText?: unknown } | null)?.answerText === "string"
    ? (entry.structuredAnswer as { answerText: string }).answerText
    : (entry.promptInteraction?.rawResponseText ?? "");

const buildNStageAppendix = (fixture: ReturnType<typeof createDeepResearchFullCaseFixture>): string =>
  fixture.fullCaseFile.subQuestionAnalyses.map((entry) => [
    `<article data-sub-question-id="${entry.subQuestionId}">`,
    `<h3>${entry.title ?? entry.subQuestionId}</h3>`,
    `<p>Question: ${entry.questionText}</p>`,
    `<p>Parse status: ${entry.promptInteraction?.parseStatus ?? entry.structuredAnswerStatus}</p>`,
    `<p>Raw response hash: ${entry.promptInteraction?.rawResponseHash ?? "missing"}</p>`,
    `<pre>${readNStageSourceText(entry)}</pre>`,
    "</article>",
  ].join("")).join("");

const buildValidHtml = (fixture: ReturnType<typeof createDeepResearchFullCaseFixture>): string => buildHtml([
  `<section id="summary-answer"><h2>Summary Answer</h2><p>Quick answer for ${fixture.fullCaseFile.job.jobId}.</p></section>`,
  `<section id="forensics-process"><h2>Forensics Process</h2><p>Job ID ${fixture.fullCaseFile.job.jobId}; decomposition, N-stage analysis, final adjudication, and export refs are visible.</p></section>`,
  `<section id="business-conclusion"><h2>Final Conclusion</h2><p>Conclusion preserves the final adjudication meaning.</p></section>`,
  `<section id="n-stage-questions-and-answers"><h2>N-stage Questions and Answers</h2>${buildNStageAppendix(fixture)}</section>`,
].join(""));

const readFailureReason = (result: ReturnType<typeof parseAndPersistBusinessHtmlReport>): string | null =>
  result.parsed === null ? result.reason : null;

const fixture = createDeepResearchFullCaseFixture();

try {
  const oneVoiceHtml = buildHtml("<h1>One Voice Report</h1><p>Only the final answer appears here.</p>");
  const invalidResult = parseAndPersistBusinessHtmlReport({
    fullCaseFile: fixture.fullCaseFile,
    rawText: oneVoiceHtml,
    outputPath: path.join(mkdtempSync(path.join(tmpdir(), "grasseye-html-full-process-invalid-")), "business-report.html"),
  });
  if (invalidResult.parsed !== null) {
    throw new Error("One-voice HTML must not persist as a business report.");
  }
  assert.equal(invalidResult.reason, "business_html_document_missing", "Missing full-process sections must use the HTML document failure reason.");

  const wrongJobHtml = buildValidHtml(fixture).split(fixture.fullCaseFile.job.jobId).join("deep_research_job_wrong");
  const wrongJobResult = parseAndPersistBusinessHtmlReport({
    fullCaseFile: fixture.fullCaseFile,
    rawText: wrongJobHtml,
    outputPath: path.join(mkdtempSync(path.join(tmpdir(), "grasseye-html-wrong-job-")), "business-report.html"),
  });
  assert.equal(readFailureReason(wrongJobResult), "business_html_case_file_job_id_missing", "HTML from another job must not persist.");

  const missingCitationHtml = buildValidHtml(fixture).replace("sha256:fixture-analysis-q1-raw", "sha256:missing-q1");
  const missingCitationResult = parseAndPersistBusinessHtmlReport({
    fullCaseFile: fixture.fullCaseFile,
    rawText: missingCitationHtml,
    outputPath: path.join(mkdtempSync(path.join(tmpdir(), "grasseye-html-missing-citation-")), "business-report.html"),
  });
  if (missingCitationResult.parsed === null) {
    throw new Error("HTML missing model-supplied citations must be repaired by the canonical N-stage appendix.");
  }
  const repairedCitationHtml = readFileSync(missingCitationResult.parsed.filePath, "utf8");
  assert(repairedCitationHtml.includes("canonical-n-stage-retention-appendix"), "Canonical appendix must be persisted.");
  assert(repairedCitationHtml.includes("sha256:fixture-analysis-q1-raw"), "Canonical appendix must cite each raw response hash.");

  const thinHtml = buildHtml([
    `<section id="summary-answer"><h2>Summary Answer</h2><p>${fixture.fullCaseFile.job.jobId}</p></section>`,
    "<section id=\"forensics-process\"><h2>Forensics Process</h2><p>Trace visible.</p></section>",
    "<section id=\"business-conclusion\"><h2>Final Conclusion</h2><p>Conclusion.</p></section>",
    `<section id="n-stage-questions-and-answers"><h2>N-stage Questions and Answers</h2><p>${fixture.fullCaseFile.subQuestionAnalyses.map((entry) => entry.promptInteraction?.rawResponseHash).join(" ")}</p><p>Too short.</p></section>`,
  ].join(""));
  const thinResult = parseAndPersistBusinessHtmlReport({
    fullCaseFile: fixture.fullCaseFile,
    rawText: thinHtml,
    outputPath: path.join(mkdtempSync(path.join(tmpdir(), "grasseye-html-thin-")), "business-report.html"),
  });
  if (thinResult.parsed === null) {
    throw new Error("Thin model HTML must be repaired by the canonical N-stage appendix.");
  }
  const repairedThinHtml = readFileSync(thinResult.parsed.filePath, "utf8");
  for (const entry of fixture.fullCaseFile.subQuestionAnalyses) {
    assert(repairedThinHtml.includes(readNStageSourceText(entry)), "Canonical appendix must preserve N-stage source material.");
  }

  const validHtml = buildValidHtml(fixture);
  const validResult = parseAndPersistBusinessHtmlReport({
    fullCaseFile: fixture.fullCaseFile,
    rawText: validHtml,
    outputPath: path.join(mkdtempSync(path.join(tmpdir(), "grasseye-html-full-process-valid-")), "business-report.html"),
  });
  if (validResult.parsed === null) {
    throw new Error("Full-process HTML must return a parsed business report record.");
  }
  assert.equal(validResult.parseStatus, "parsed", "Full-process HTML must persist.");
  assert.equal(validResult.parsed.exportKind, "business-report.html", "Parsed report must remain the primary business HTML artifact.");
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

process.stdout.write("[ACCEPTANCE][deep-research-html-full-process-report] PASS\n");
