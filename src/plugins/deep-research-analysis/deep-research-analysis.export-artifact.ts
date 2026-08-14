import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { createDeepResearchRecordStore, type ResearchExportKind } from "./deep-research-analysis.records.js";

export type DeepResearchExportArtifactPayload = {
  jobId: string;
  kind: ResearchExportKind;
  fileName: string;
  filePath: string;
  contentType: "text/markdown" | "text/html" | "application/json";
  fileHash: string;
  payloadHash: string;
  textContent?: string;
  jsonContent?: unknown;
  base64Content?: string;
};

export const getDeepResearchExportArtifact = (input: {
  dataDir: string;
  jobId: string;
  kind: ResearchExportKind;
}): DeepResearchExportArtifactPayload | null => {
  const store = createDeepResearchRecordStore(input.dataDir);
  try {
    const exported = store.listExports(input.jobId).find((record) => record.exportKind === input.kind);
    if (!exported || !existsSync(exported.filePath)) return null;
    const base = {
      jobId: input.jobId,
      kind: input.kind,
      fileName: path.basename(exported.filePath),
      filePath: exported.filePath,
      fileHash: exported.fileHash,
      payloadHash: exported.payloadHash,
    };
    if (input.kind === "final-adjudication-raw.md" || input.kind === "full-case-file.md") {
      return { ...base, contentType: "text/markdown", textContent: readFileSync(exported.filePath, "utf8") };
    }
    if (input.kind === "business-report.html") {
      return { ...base, contentType: "text/html", textContent: readFileSync(exported.filePath, "utf8") };
    }
    return {
      ...base,
      contentType: "application/json",
      jsonContent: JSON.parse(readFileSync(exported.filePath, "utf8")) as unknown,
    };
  } finally {
    store.close();
  }
};
