import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { saveFullCaseFileExports } from "../../src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.js";
import {
    createDeepResearchFullCaseFixture,
    disposeDeepResearchFullCaseFixture,
} from "./deep-research-full-case-file-support.js";

const fixture = createDeepResearchFullCaseFixture();

try {
  assert.equal(fixture.fullCaseFile.caseFileVersion, "v1");
  assert.equal(fixture.fullCaseFile.coverage.totalSubQuestionCount, 2);
  assert.equal(fixture.fullCaseFile.coverage.structuredAnalysisCount, 1);
  assert.equal(fixture.fullCaseFile.coverage.rawAnalysisInteractionCount, 2);
  assert.equal(fixture.fullCaseFile.subQuestionAnalyses[1]?.structuredAnswerStatus, "parse_failed_raw_available");
  assert.equal(fixture.fullCaseFile.failedButRawAvailableInteractions.length, 1);
  assert.match(
    fixture.fullCaseFile.failedButRawAvailableInteractions[0]?.rawResponseText ?? "",
    /Narrative raw-only analysis for Q2/u,
  );

  const exportDir = path.join(
    fixture.dataDir,
    "deep-research-analysis",
    "exports",
    fixture.job.id,
  );
  const exports = saveFullCaseFileExports({
    store: fixture.store,
    jobId: fixture.job.id,
    exportDir,
    fullCaseFile: fixture.fullCaseFile,
  });
  assert.equal(exports.fullCaseFileJson.exportKind, "full-case-file.json");
  assert.equal(exports.fullCaseFileMarkdown.exportKind, "full-case-file.md");
  assert(existsSync(exports.fullCaseFileJson.filePath));
  assert(existsSync(exports.fullCaseFileMarkdown.filePath));

  const caseFileJson = JSON.parse(readFileSync(exports.fullCaseFileJson.filePath, "utf8")) as {
    failedButRawAvailableInteractions: Array<{ parseStatus: string; rawResponseText: string }>;
  };
  const caseFileMarkdown = readFileSync(exports.fullCaseFileMarkdown.filePath, "utf8");
  assert.equal(caseFileJson.failedButRawAvailableInteractions[0]?.parseStatus, "parse_failed_raw_available");
  assert.match(caseFileMarkdown, /Full Case File/u);
  assert.match(caseFileMarkdown, /Narrative raw-only analysis for Q2/u);
  assert.match(caseFileMarkdown, /parse_failed_raw_available/u);
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

process.stdout.write("[ACCEPTANCE][deep-research-full-case-file] PASS\n");