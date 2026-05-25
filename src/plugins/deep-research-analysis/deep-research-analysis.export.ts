import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableJsonHash } from "../../lib/storage/hash.js";
import { buildDeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file.js";
import { saveFullCaseFileExports } from "./deep-research-analysis.full-case-file-export.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";
import type { DeepResearchFinalAdjudicationRecord } from "./deep-research-analysis.result.js";
import type { DeepResearchStructuredIndex } from "./deep-research-analysis.structured-index.js";
import type {
  DeepResearchRecordStore,
  ResearchAnswer,
  ResearchExport,
  ResearchFinalAdjudicationRecord,
  ResearchInteraction,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";

export const FINAL_ADJUDICATION_RAW_EXPORT_KIND = "final-adjudication-raw.md" as const;
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
  finalAdjudicationRaw: ResearchExport;
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
  finalAdjudicationRecord: ResearchFinalAdjudicationRecord;
  businessHtmlExport: ResearchExport;
  evidenceIndex: DeepResearchEvidenceIndexEntry[];
};

type DeepResearchExportFiles = {
  finalAdjudicationRawArtifact: { filePath: string; fileHash: string };
  structuredIndexArtifact: { filePath: string; fileHash: string };
  evidenceIndexArtifact: { filePath: string; fileHash: string };
  fullCaseFileExports: ReturnType<typeof saveFullCaseFileExports>;
};

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const buildExportDir = (dataDir: string, jobId: string): string =>
  path.join(dataDir, "deep-research-analysis", "exports", jobId);

const renderFinalAdjudicationMarkdown = (
  finalAdjudication: DeepResearchFinalAdjudicationRecord,
): string => `${finalAdjudication.rawFinalAnswerText.trimEnd()}\n`;

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

const requireFinalAdjudicationRecord = (
  store: DeepResearchRecordStore,
  jobId: string,
): ResearchFinalAdjudicationRecord => {
  const finalAdjudicationRecord = store.getLatestFinalAdjudication(jobId);
  if (!finalAdjudicationRecord) {
    throw new Error("Deep Research final adjudication record is missing.");
  }
  return finalAdjudicationRecord;
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
  finalAdjudicationRecord: ResearchFinalAdjudicationRecord;
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
      && input.finalAdjudicationRecord.interactionId === interaction.id
    ) {
      entries.push({ ...base, parsedRecordId: input.finalAdjudicationRecord.id });
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
  const finalAdjudicationRecord = requireFinalAdjudicationRecord(input.store, input.jobId);
  const businessHtmlExport = requireBusinessHtmlExport(input.store, input.jobId);
  const evidenceIndex = buildEvidenceIndexEntries({
    interactions: input.store.listInteractions(input.jobId),
    subQuestions: input.store.listSubQuestions(input.jobId),
    answers: input.store.listAnswers({ jobId: input.jobId }),
    finalAdjudicationRecord,
    businessHtmlExport,
  });
  return {
    exportDir,
    fullCaseFile,
    finalAdjudicationRecord,
    businessHtmlExport,
    evidenceIndex,
  };
};

const writeExportFiles = (input: {
  state: DeepResearchExportState;
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
}): DeepResearchExportFiles => ({
  finalAdjudicationRawArtifact: writeTextArtifact(
    path.join(input.state.exportDir, FINAL_ADJUDICATION_RAW_EXPORT_KIND),
    renderFinalAdjudicationMarkdown(input.finalAdjudication),
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
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
  state: DeepResearchExportState;
  files: DeepResearchExportFiles;
}): DeepResearchExportArtifacts => ({
  finalAdjudicationRaw: input.store.saveExport({
    jobId: input.jobId,
    exportKind: FINAL_ADJUDICATION_RAW_EXPORT_KIND,
    filePath: input.files.finalAdjudicationRawArtifact.filePath,
    fileHash: input.files.finalAdjudicationRawArtifact.fileHash,
    payload: input.finalAdjudication,
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
  finalAdjudication: DeepResearchFinalAdjudicationRecord;
}): Promise<DeepResearchExportArtifacts> => {
  const state = resolveExportState(input);
  const files = writeExportFiles({
    state,
    store: input.store,
    jobId: input.jobId,
    structuredIndex: input.structuredIndex,
    finalAdjudication: input.finalAdjudication,
  });
  return persistExportRecords({
    store: input.store,
    jobId: input.jobId,
    structuredIndex: input.structuredIndex,
    finalAdjudication: input.finalAdjudication,
    state,
    files,
  });
};
