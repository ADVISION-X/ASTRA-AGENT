import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { saveFullCaseFileExports } from "../../src/plugins/deep-research-analysis/deep-research-analysis.full-case-file.js";
import {
  createDeepResearchFullCaseFixture,
  disposeDeepResearchFullCaseFixture,
} from "./deep-research-full-case-file-support.js";

const fixtureDataDir = mkdtempSync(path.join(tmpdir(), "deep-research-input-attachment-acceptance-"));
const attachmentPath = path.join(fixtureDataDir, "input-brief.txt");
writeFileSync(attachmentPath, "Customer supplied local file for every Deep Research AI feed.\n", "utf8");

const fixture = createDeepResearchFullCaseFixture({
  inputAttachments: [{
    id: "acceptance-input-attachment",
    filePath: attachmentPath,
    mimeType: "text/plain",
    summary: "input-brief.txt",
    fileHash: "sha256:acceptance-input-attachment",
    fileSizeBytes: 64,
    sourceKind: "app-file-picker",
  }],
});

try {
  assert.equal(fixture.fullCaseFile.inputAttachments.length, 1);
  assert.equal(fixture.fullCaseFile.inputAttachments[0]?.id, "acceptance-input-attachment");
  assert.equal(fixture.fullCaseFile.inputAttachments[0]?.filePath, attachmentPath);
  assert.equal(fixture.fullCaseFile.inputAttachments[0]?.sourceKind, "app-file-picker");
  assert.match(fixture.fullCaseFileMarkdown, /Input Attachments/u);
  assert.match(fixture.fullCaseFileMarkdown, /acceptance-input-attachment/u);

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
  assert(existsSync(exports.fullCaseFileJson.filePath));
  assert(existsSync(exports.fullCaseFileMarkdown.filePath));

  const caseFileJson = JSON.parse(readFileSync(exports.fullCaseFileJson.filePath, "utf8")) as {
    inputAttachments: Array<{
      id: string;
      filePath: string;
      sourceKind: string;
    }>;
  };
  const caseFileMarkdown = readFileSync(exports.fullCaseFileMarkdown.filePath, "utf8");
  assert.equal(caseFileJson.inputAttachments[0]?.id, "acceptance-input-attachment");
  assert.equal(caseFileJson.inputAttachments[0]?.filePath, attachmentPath);
  assert.equal(caseFileJson.inputAttachments[0]?.sourceKind, "app-file-picker");
  assert.match(caseFileMarkdown, /Input Attachments/u);
  assert.match(caseFileMarkdown, /input-brief\.txt/u);
} finally {
  disposeDeepResearchFullCaseFixture(fixture);
}

process.stdout.write("[ACCEPTANCE][deep-research-input-attachments] PASS\n");
