import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  detectHtmlArtifactInWebChatResponse,
  downloadWebChatHtmlArtifact,
} from "../../src/capabilities/ai-input-gateway/index.js";
import {
  buildBusinessHtmlReportOutputPath,
  parseAndPersistBusinessHtmlReport,
} from "../../src/plugins/deep-research-analysis/deep-research-analysis.html-report-export.js";

const dataDir = mkdtempSync(path.join(tmpdir(), "grasseye-html-report-"));
const artifactDir = path.join(dataDir, "artifacts");
mkdirSync(artifactDir, { recursive: true });

const validHtmlDocument = [
  "<!DOCTYPE html>",
  "<html>",
  "<head><meta charset=\"utf-8\"><title>Business Report</title><style>body{font-family:sans-serif;}</style></head>",
  "<body><main><h1>Decision</h1><p>Ship the HTML report.</p></main></body>",
  "</html>",
].join("");

const sourceHtmlPath = path.join(artifactDir, "business-report.html");
writeFileSync(sourceHtmlPath, validHtmlDocument, "utf8");

const artifactCandidate = detectHtmlArtifactInWebChatResponse(
  `HTML_ARTIFACT_PATH=${sourceHtmlPath}`,
);
assert(artifactCandidate, "HTML artifact detector must find a valid HTML artifact path.");
assert.equal(artifactCandidate?.artifactName, "business-report.html");

const downloadResult = downloadWebChatHtmlArtifact({
  candidate: artifactCandidate,
  outputPath: path.join(dataDir, "exports", "artifact-copy.html"),
});
assert(downloadResult.ok, "HTML artifact download must succeed.");
if (downloadResult.ok) {
  assert(downloadResult.filePath.endsWith(".html"));
  assert(downloadResult.fileHash.startsWith("sha256:"));
  assert(downloadResult.fileSizeBytes > 0);
}

const outputPath = buildBusinessHtmlReportOutputPath(dataDir, "job-html");
const artifactParse = parseAndPersistBusinessHtmlReport({
  rawText: `Generated file: ${sourceHtmlPath}`,
  outputPath,
});
assert.equal(artifactParse.parseStatus, "parsed");
if (artifactParse.parseStatus === "parsed") {
  assert.equal(artifactParse.parsed.exportKind, "business-report.html");
  assert.equal(artifactParse.parsed.sourceKind, "html_artifact");
  assert.equal(artifactParse.parsed.status, "business_html_report_generated");
}

const rawHtmlParse = parseAndPersistBusinessHtmlReport({
  rawText: validHtmlDocument,
  outputPath: path.join(dataDir, "exports", "raw-business-report.html"),
});
assert.equal(rawHtmlParse.parseStatus, "partial_review_required");
assert.equal(rawHtmlParse.reason, "business_html_artifact_missing");

const fencedHtml = `\`\`\`html\n${validHtmlDocument}\n\`\`\``;
const fencedHtmlParse = parseAndPersistBusinessHtmlReport({
  rawText: fencedHtml,
  outputPath: path.join(dataDir, "exports", "fenced-business-report.html"),
});
assert.equal(fencedHtmlParse.parseStatus, "partial_review_required");
assert.equal(fencedHtmlParse.reason, "business_html_artifact_missing");

const missingParse = parseAndPersistBusinessHtmlReport({
  rawText: "No artifact here.",
  outputPath: path.join(dataDir, "exports", "missing.html"),
});
assert.equal(missingParse.parseStatus, "partial_review_required");
assert.equal(missingParse.reason, "business_html_artifact_missing");

const invalidArtifactPath = path.join(artifactDir, "notes.txt");
writeFileSync(invalidArtifactPath, "plain text", "utf8");
const invalidDownload = downloadWebChatHtmlArtifact({
  candidate: {
    artifactName: "notes.txt",
    artifactMimeType: "text/plain",
    sourcePath: invalidArtifactPath,
  },
  outputPath: path.join(dataDir, "exports", "invalid.html"),
});
assert(!invalidDownload.ok && invalidDownload.status === "business_html_invalid_file");

const brokenHtmlPath = path.join(artifactDir, "broken.html");
writeFileSync(brokenHtmlPath, "plain text masquerading as html", "utf8");
const invalidArtifactParse = parseAndPersistBusinessHtmlReport({
  rawText: `artifactPath=${brokenHtmlPath}`,
  outputPath: path.join(dataDir, "exports", "broken-artifact.html"),
});
assert.equal(invalidArtifactParse.parseStatus, "partial_review_required");
assert.equal(invalidArtifactParse.reason, "business_html_invalid_file");

process.stdout.write("[ACCEPTANCE][deep-research-html-artifact-persist] PASS\n");
