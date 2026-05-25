import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { parseAndPersistBusinessHtmlReport } from "../../src/plugins/deep-research-analysis/deep-research-analysis.html-report-export.js";

const outputPath = path.join(
  mkdtempSync(path.join(tmpdir(), "grasseye-deep-research-inline-html-")),
  "business-report.html",
);
const htmlExportSource = readFileSync("src/plugins/deep-research-analysis/deep-research-analysis.html-report-export.ts", "utf8");

const rawText = [
  "```html",
  "<!DOCTYPE html>",
  "<html><head><meta charset=\"utf-8\"><title>Business Report</title></head><body><main><h1>Decision Report</h1><p>Inline HTML delivery must persist directly.</p></main></body></html>",
  "```",
].join("\n");

const result = parseAndPersistBusinessHtmlReport({ rawText, outputPath });

assert.equal(result.parseStatus, "parsed", "Inline HTML should parse as a successful business report.");
assert(result.parsed, "Inline HTML should produce a persisted business HTML record.");
assert.equal(result.parsed.sourceKind, "inline_html_document", "Inline HTML should be marked as direct HTML delivery.");
assert.equal(result.parsed.exportKind, "business-report.html", "Inline HTML should persist to the canonical business HTML export kind.");
assert.equal(result.parsed.filePath, outputPath, "Inline HTML should persist to the expected output path.");
assert.match(readFileSync(outputPath, "utf8"), /Inline HTML delivery must persist directly\./, "Persisted HTML must contain the original inline document.");
assert(!htmlExportSource.includes("downloadWebChatHtmlArtifact"), "Deep Research HTML export must not download provider HTML artifacts.");
assert(!htmlExportSource.includes("detectHtmlArtifactInWebChatResponse"), "Deep Research HTML export must not accept artifact-path HTML responses.");

process.stdout.write("[ACCEPTANCE][deep-research-inline-html-report] PASS\n");