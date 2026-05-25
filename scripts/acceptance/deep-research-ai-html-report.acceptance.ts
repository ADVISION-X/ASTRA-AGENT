import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  businessHtmlReportPublisherPrompt,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.html-report-prompt.js";

const decode = (value: string): string => Buffer.from(value, "base64").toString("utf8");
const read = (filePath: string): string => readFileSync(filePath, "utf8");

const analysisRunnerText = read(
  "src/plugins/deep-research-analysis/deep-research-analysis.analysis-runner.ts",
);
const htmlStageText = read(
  "src/plugins/deep-research-analysis/deep-research-analysis.html-report-stage.ts",
);
const schemaText = read(
  "src/plugins/deep-research-analysis/deep-research-analysis.schema.ts",
);
const exportText = read(
  "src/plugins/deep-research-analysis/deep-research-analysis.export.ts",
);

assert.equal(
  businessHtmlReportPublisherPrompt.expectedOutputContract.format,
  "html_artifact",
  "Primary Deep Research delivery must target an HTML artifact.",
);
assert.equal(
  businessHtmlReportPublisherPrompt.phase,
  "html_report",
  "Business HTML report prompt must use the html_report interaction phase.",
);

for (const marker of [
  "runBusinessHtmlReportPhase",
  "businessHtmlReport",
] as const) {
  assert(
    analysisRunnerText.includes(marker),
    `Analysis runner must include ${marker}.`,
  );
}
assert(
  !analysisRunnerText.includes(decode("cnVuQnVzaW5lc3NEZWNrUGhhc2U=")),
  "Primary Deep Research completion must not route through retired presentation stages.",
);

for (const marker of [
  "businessHtmlReportPublisherPrompt",
  "renderDeepResearchBusinessHtmlReportPrompt",
  "parseAndPersistBusinessHtmlReport",
  'promptKey: "business-html-report"',
  'send: "HTML_REPORT_SEND"',
  'capture: "HTML_REPORT_CAPTURE"',
  'parse: "HTML_REPORT_DETECT"',
  'persist: "HTML_REPORT_PERSIST"',
] as const) {
  assert(
    htmlStageText.includes(marker),
    `Business HTML report stage must include ${marker}.`,
  );
}

assert(
  !htmlStageText.includes("parsed_text_fallback"),
  "Business HTML report stage must not accept raw HTML text fallback as completion.",
);

for (const stage of [
  "HTML_REPORT_SEND",
  "HTML_REPORT_CAPTURE",
  "HTML_REPORT_DETECT",
  "HTML_REPORT_PERSIST",
] as const) {
  assert(
    schemaText.includes(stage),
    `Deep Research schema must expose ${stage}.`,
  );
}
assert(
  schemaText.includes('"html_report"'),
  "Deep Research interaction phases must include html_report.",
);

for (const marker of [
  '"business-report.html"',
  "businessHtmlReport",
] as const) {
  assert(
    exportText.includes(marker),
    `Deep Research export pipeline must include ${marker}.`,
  );
}

process.stdout.write("[ACCEPTANCE][deep-research-ai-html-report] PASS\n");
