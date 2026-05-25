import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableJsonHash } from "../../lib/storage/hash.js";
import { buildDeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file.js";
import { saveFullCaseFileExports } from "./deep-research-analysis.full-case-file-export.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type { DeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";
import type {
  DeepResearchRecordStore,
  ResearchAnswer,
  ResearchExport,
  ResearchFinalReportRecord,
  ResearchInteraction,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";

export const FINAL_REPORT_EXPORT_KIND = "final-report.md" as const;
export const STRUCTURED_INDEX_EXPORT_KIND = "structured-index.json" as const;
export const EVIDENCE_INDEX_EXPORT_KIND = "evidence-index.json" as const;

type DeepResearchEvidenceIndexEntry = {
  interactionId: string;
  phase: ResearchInteraction["phase"];
  promptHash: string;
  rawResponseHash: string;
  parsedRecordId: string;
  domRef: string | null;
};

type DeepResearchExportArtifacts = {
  finalReportMarkdown: ResearchExport;
  fullCaseFileJson: ResearchExport;
  fullCaseFileMarkdown: ResearchExport;
  structuredIndex: ResearchExport;
  businessHtmlReport: ResearchExport;
  evidenceIndex: ResearchExport;
  exportDir: string;
  status: "completed";
  failureReason: null;
};

type DeepResearchExportState = {
  exportDir: string;
  fullCaseFile: DeepResearchFullCaseFile;
  finalReportRecord: ResearchFinalReportRecord;
  businessHtmlExport: ResearchExport;
  evidenceIndex: DeepResearchEvidenceIndexEntry[];
};

type DeepResearchExportFiles = {
  finalReportMarkdownArtifact: { filePath: string; fileHash: string };
  structuredIndexArtifact: { filePath: string; fileHash: string };
  evidenceIndexArtifact: { filePath: string; fileHash: string };
  fullCaseFileExports: ReturnType<typeof saveFullCaseFileExports>;
};

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const buildExportDir = (dataDir: string, jobId: string): string =>
  path.join(dataDir, "deep-research-analysis", "exports", jobId);

const renderFinalReportMarkdown = (finalReport: DeepResearchFinalReport): string => [
  "# Final Report",
  "",
  `Confidence: ${finalReport.confidence}`,
  "",
  "## Summary",
  finalReport.summary,
  "",
  "## References",
  finalReport.references.length > 0 ? finalReport.references.map((item) => `- ${item}`).join("\n") : "- unavailable",
  "",
  "## Source Notes",
  finalReport.sourceNotes.length > 0
    ? finalReport.sourceNotes.map((note) => `- ${note.label}: ${note.note}`).join("\n")
    : "- unavailable",
  "",
  "## Structured Payload",
  "```json",
  JSON.stringify(finalReport.structuredPayload, null, 2),
  "```",
].join("\n");

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

const requireFinalReportRecord = (
  store: DeepResearchRecordStore,
  jobId: string,
): ResearchFinalReportRecord => {
  const finalReportRecord = store.getLatestFinalReport(jobId);
  if (!finalReportRecord) {
    throw new Error("Deep Research final report record is missing.");
  }
  return finalReportRecord;
};

const requireBusinessHtmlExport = (
  store: DeepResearchRecordStore,
  jobId: string,
): ResearchExport => {
  const businessHtmlExport = store.listExports(jobId)
    .find((record) => record.exportKind === "business-report.html") ?? null;
  if (!businessHtmlExport) {
    throw new Error("Deep Research primary business HTML report is missing.");
  }
  return businessHtmlExport;
};

const buildEvidenceIndexEntries = (input: {
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalReportRecord: ResearchFinalReportRecord;
  businessHtmlExport: ResearchExport | null;
}): DeepResearchEvidenceIndexEntry[] => {
  const entries: DeepResearchEvidenceIndexEntry[] = [];
  input.interactions.forEach((interaction) => {
    const base = {
      interactionId: interaction.id,
      phase: interaction.phase,
      promptHash: interaction.promptHash,
      rawResponseHash: interaction.rawResponseHash,
      domRef: interaction.domRef,
    };
    if (interaction.phase === "decomposition") {
      input.subQuestions
        .filter((record) => record.interactionId === interaction.id)
        .forEach((record) => entries.push({ ...base, parsedRecordId: record.id }));
      return;
    }
    if (interaction.phase === "analysis") {
      input.answers
        .filter((record) => record.interactionId === interaction.id)
        .forEach((record) => entries.push({ ...base, parsedRecordId: record.id }));
      return;
    }
    if (
      interaction.phase === "final_adjudication"
      && input.finalReportRecord.interactionId === interaction.id
    ) {
      entries.push({ ...base, parsedRecordId: input.finalReportRecord.id });
      return;
    }
    if (interaction.phase === "html_report" && input.businessHtmlExport) {
      entries.push({ ...base, parsedRecordId: input.businessHtmlExport.id });
    }
  });
  return entries;
};

const resolveExportState = (input: {
  dataDir: string;
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  fullCaseFile?: DeepResearchFullCaseFile;
}): DeepResearchExportState => {
  const exportDir = buildExportDir(input.dataDir, input.jobId);
  mkdirSync(exportDir, { recursive: true });
  const fullCaseFile = input.fullCaseFile ?? buildDeepResearchFullCaseFile({
    store: input.store,
    jobId: input.jobId,
    structuredIndex: input.structuredIndex,
  });
  const finalReportRecord = requireFinalReportRecord(input.store, input.jobId);
  const businessHtmlExport = requireBusinessHtmlExport(input.store, input.jobId);
  const evidenceIndex = buildEvidenceIndexEntries({
    interactions: input.store.listInteractions(input.jobId),
    subQuestions: input.store.listSubQuestions(input.jobId),
    answers: input.store.listAnswers({ jobId: input.jobId }),
    finalReportRecord,
    businessHtmlExport,
  });
  return {
    exportDir,
    fullCaseFile,
    finalReportRecord,
    businessHtmlExport,
    evidenceIndex,
  };
};

const writeExportFiles = (input: {
  state: DeepResearchExportState;
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  finalReport: DeepResearchFinalReport;
}): DeepResearchExportFiles => ({
  finalReportMarkdownArtifact: writeTextArtifact(
    path.join(input.state.exportDir, FINAL_REPORT_EXPORT_KIND),
    renderFinalReportMarkdown(input.finalReport),
  ),
  structuredIndexArtifact: writeJsonArtifact(
    path.join(input.state.exportDir, STRUCTURED_INDEX_EXPORT_KIND),
    input.structuredIndex,
  ),
  evidenceIndexArtifact: writeJsonArtifact(
    path.join(input.state.exportDir, EVIDENCE_INDEX_EXPORT_KIND),
    input.state.evidenceIndex,
  ),
  fullCaseFileExports: saveFullCaseFileExports({
    store: input.store,
    jobId: input.jobId,
    exportDir: input.state.exportDir,
    fullCaseFile: input.state.fullCaseFile,
  }),
});

const persistExportRecords = (input: {
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  finalReport: DeepResearchFinalReport;
  state: DeepResearchExportState;
  files: DeepResearchExportFiles;
}): DeepResearchExportArtifacts => ({
  finalReportMarkdown: input.store.saveExport({
    jobId: input.jobId,
    exportKind: FINAL_REPORT_EXPORT_KIND,
    filePath: input.files.finalReportMarkdownArtifact.filePath,
    fileHash: input.files.finalReportMarkdownArtifact.fileHash,
    payload: input.finalReport,
  }),
  fullCaseFileJson: input.files.fullCaseFileExports.fullCaseFileJson,
  fullCaseFileMarkdown: input.files.fullCaseFileExports.fullCaseFileMarkdown,
  structuredIndex: input.store.saveExport({
    jobId: input.jobId,
    exportKind: STRUCTURED_INDEX_EXPORT_KIND,
    filePath: input.files.structuredIndexArtifact.filePath,
    fileHash: input.files.structuredIndexArtifact.fileHash,
    payload: input.structuredIndex,
  }),
  businessHtmlReport: input.state.businessHtmlExport,
  evidenceIndex: input.store.saveExport({
    jobId: input.jobId,
    exportKind: EVIDENCE_INDEX_EXPORT_KIND,
    filePath: input.files.evidenceIndexArtifact.filePath,
    fileHash: input.files.evidenceIndexArtifact.fileHash,
    payload: input.state.evidenceIndex,
  }),
  exportDir: input.state.exportDir,
  status: "completed",
  failureReason: null,
});

export const exportDeepResearchArtifacts = async (input: {
  dataDir: string;
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  fullCaseFile?: DeepResearchFullCaseFile;
  finalReport: DeepResearchFinalReport;
}): Promise<DeepResearchExportArtifacts> => {
  const state = resolveExportState(input);
  const files = writeExportFiles({
    state,
    store: input.store,
    jobId: input.jobId,
    structuredIndex: input.structuredIndex,
    finalReport: input.finalReport,
  });
  return persistExportRecords({
    store: input.store,
    jobId: input.jobId,
    structuredIndex: input.structuredIndex,
    finalReport: input.finalReport,
    state,
    files,
  });
};
