import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableJsonHash } from "../../lib/storage/hash.js";
import {
  renderDeepResearchFullCaseFileMarkdown,
} from "./deep-research-analysis.full-case-file-render.js";
import type {
  DeepResearchFullCaseFile,
} from "./deep-research-analysis.full-case-file-schema.js";
import type {
  DeepResearchRecordStore,
  ResearchExport,
} from "./deep-research-analysis.records.js";

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const writeTextArtifact = (filePath: string, text: string): { filePath: string; fileHash: string } => {
  const fileHash = buildTextHash(text);
  writeFileSync(filePath, `${text.trimEnd()}\n`, "utf8");
  return { filePath, fileHash };
};

const writeJsonArtifact = <TPayload>(filePath: string, payload: TPayload): { filePath: string; fileHash: string } => {
  const fileHash = stableJsonHash(payload);
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return { filePath, fileHash };
};

export type DeepResearchFullCaseFileExports = {
  fullCaseFile: DeepResearchFullCaseFile;
  fullCaseFileMarkdownText: string;
  fullCaseFileJson: ResearchExport;
  fullCaseFileMarkdown: ResearchExport;
};

export const saveFullCaseFileExports = (input: {
  store: DeepResearchRecordStore;
  jobId: string;
  exportDir: string;
  fullCaseFile: DeepResearchFullCaseFile;
}): DeepResearchFullCaseFileExports => {
  mkdirSync(input.exportDir, { recursive: true });
  const fullCaseFileMarkdownText = renderDeepResearchFullCaseFileMarkdown(input.fullCaseFile);
  const fullCaseFileJsonArtifact = writeJsonArtifact(
    path.join(input.exportDir, "full-case-file.json"),
    input.fullCaseFile,
  );
  const fullCaseFileMarkdownArtifact = writeTextArtifact(
    path.join(input.exportDir, "full-case-file.md"),
    fullCaseFileMarkdownText,
  );
  return {
    fullCaseFile: input.fullCaseFile,
    fullCaseFileMarkdownText,
    fullCaseFileJson: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "full-case-file.json",
      filePath: fullCaseFileJsonArtifact.filePath,
      fileHash: fullCaseFileJsonArtifact.fileHash,
      payload: input.fullCaseFile,
    }),
    fullCaseFileMarkdown: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "full-case-file.md",
      filePath: fullCaseFileMarkdownArtifact.filePath,
      fileHash: fullCaseFileMarkdownArtifact.fileHash,
      payload: {
        fullCaseFileJsonHash: fullCaseFileJsonArtifact.fileHash,
        content: fullCaseFileMarkdownText,
      },
    }),
  };
};