import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableJsonHash } from "../../lib/storage/hash.js";
import { buildDeepResearchFullFlowReportMarkdown } from "./deep-research-analysis.export-markdown.js";
import { buildDeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file.js";
import { saveFullCaseFileExports } from "./deep-research-analysis.full-case-file-export.js";
import type { DeepResearchFullCaseFile } from "./deep-research-analysis.full-case-file-schema.js";
import type {
  DeepResearchFinalReport,
} from "./deep-research-analysis.result.js";
import type {
  DeepResearchStructuredIndex,
} from "./deep-research-analysis.structured-index.js";
import type {
  DeepResearchRecordStore,
  ResearchExport,
  ResearchFinalReportRecord,
  ResearchInteraction,
  ResearchSubQuestion,
  ResearchAnswer,
} from "./deep-research-analysis.records.js";

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

type DeepResearchPersistedExportState = {
  job: ReturnType<DeepResearchRecordStore["getJob"]> extends infer TJob | null ? TJob : never;
  finalReportRecord: ResearchFinalReportRecord | null;
  interactions: ResearchInteraction[];
  subQuestions: ResearchSubQuestion[];
  answers: ResearchAnswer[];
  exports: ResearchExport[];
};

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const buildExportDir = (dataDir: string, jobId: string): string =>
  path.join(dataDir, "deep-research-analysis", "exports", jobId);

const STRUCTURED_INDEX_EXPORT_KIND = "structured-index.json";

const buildEvidenceIndexEntries = (input: {
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalReportRecord: ResearchFinalReportRecord | null;
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
      && input.finalReportRecord
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

const loadPersistedExportState = (
  store: DeepResearchRecordStore,
  jobId: string,
): DeepResearchPersistedExportState => {
  const job = store.getJob(jobId);
  if (!job) {
    throw new Error(`Deep research job ${jobId} was not found.`);
  }

  return {
    job,
    finalReportRecord: store.getLatestFinalReport(jobId),
    interactions: store.listInteractions(jobId),
    subQuestions: store.listSubQuestions(jobId),
    answers: store.listAnswers({ jobId }),
    exports: store.listExports(jobId),
  };
};

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

type DeepResearchPreparedExportArtifacts = {
  persisted: DeepResearchPersistedExportState;
  structuredIndex: DeepResearchStructuredIndex;
  finalReportMarkdownText: string;
  finalReportArtifact: { filePath: string; fileHash: string };
  structuredIndexArtifact: { filePath: string; fileHash: string };
  businessHtmlExport: ResearchExport | null;
  evidenceIndex: DeepResearchEvidenceIndexEntry[];
  evidenceIndexArtifact: { filePath: string; fileHash: string };
};

const prepareExportArtifacts = (input: {
  persisted: DeepResearchPersistedExportState;
  structuredIndex: DeepResearchStructuredIndex;
  exportDir: string;
  finalReportMarkdownText: string;
}): DeepResearchPreparedExportArtifacts => {
  const finalReportArtifact = writeTextArtifact(path.join(input.exportDir, "final-report.md"), input.finalReportMarkdownText);
  const structuredIndexArtifact = writeJsonArtifact(
    path.join(input.exportDir, STRUCTURED_INDEX_EXPORT_KIND),
    input.structuredIndex,
  );
  const businessHtmlExport = input.persisted.exports.find((record) => record.exportKind === "business-report.html") ?? null;
  const evidenceIndex = buildEvidenceIndexEntries({
    interactions: input.persisted.interactions,
    subQuestions: input.persisted.subQuestions,
    answers: input.persisted.answers,
    finalReportRecord: input.persisted.finalReportRecord,
    businessHtmlExport,
  });
  const evidenceIndexArtifact = writeJsonArtifact(path.join(input.exportDir, "evidence-index.json"), evidenceIndex);
  return {
    persisted: input.persisted,
    structuredIndex: input.structuredIndex,
    finalReportMarkdownText: input.finalReportMarkdownText,
    finalReportArtifact,
    structuredIndexArtifact,
    businessHtmlExport,
    evidenceIndex,
    evidenceIndexArtifact,
  };
};

const savePreparedExportRecords = (input: {
  jobId: string;
  store: DeepResearchRecordStore;
  prepared: DeepResearchPreparedExportArtifacts;
}): Pick<DeepResearchExportArtifacts, "finalReportMarkdown" | "structuredIndex" | "evidenceIndex"> & {
  businessHtmlReport: ResearchExport | null;
} => ({
  finalReportMarkdown: input.store.saveExport({
    jobId: input.jobId,
    exportKind: "final-report.md",
    filePath: input.prepared.finalReportArtifact.filePath,
    fileHash: input.prepared.finalReportArtifact.fileHash,
    payload: {
      finalReportHash: input.prepared.finalReportArtifact.fileHash,
      content: input.prepared.finalReportMarkdownText,
    },
  }),
  structuredIndex: input.store.saveExport({
    jobId: input.jobId,
    exportKind: STRUCTURED_INDEX_EXPORT_KIND,
    filePath: input.prepared.structuredIndexArtifact.filePath,
    fileHash: input.prepared.structuredIndexArtifact.fileHash,
    payload: input.prepared.structuredIndex,
  }),
  businessHtmlReport: input.prepared.businessHtmlExport,
  evidenceIndex: input.store.saveExport({
    jobId: input.jobId,
    exportKind: "evidence-index.json",
    filePath: input.prepared.evidenceIndexArtifact.filePath,
    fileHash: input.prepared.evidenceIndexArtifact.fileHash,
    payload: input.prepared.evidenceIndex,
  }),
});

export const exportDeepResearchArtifacts = async (input: {
  dataDir: string;
  store: DeepResearchRecordStore;
  jobId: string;
  structuredIndex: DeepResearchStructuredIndex;
  fullCaseFile?: DeepResearchFullCaseFile;
  finalReport: DeepResearchFinalReport;
}): Promise<DeepResearchExportArtifacts> => {
  const exportDir = buildExportDir(input.dataDir, input.jobId);
  mkdirSync(exportDir, { recursive: true });
  const persisted = loadPersistedExportState(input.store, input.jobId);
  const finalReport = persisted.finalReportRecord?.report ?? input.finalReport;
  const finalReportMarkdownText = buildDeepResearchFullFlowReportMarkdown({
    finalPackage: input.structuredIndex,
    finalReport: finalReport,
    persisted: persisted,
  });
  const prepared = prepareExportArtifacts({
    persisted,
    structuredIndex: input.structuredIndex,
    exportDir,
    finalReportMarkdownText,
  });
  const fullCaseFileExports = saveFullCaseFileExports({
    store: input.store,
    jobId: input.jobId,
    exportDir,
    fullCaseFile: input.fullCaseFile ?? buildDeepResearchFullCaseFile({
      store: input.store,
      jobId: input.jobId,
      structuredIndex: input.structuredIndex,
    }),
  });
  const savedArtifacts = savePreparedExportRecords({
    jobId: input.jobId,
    store: input.store,
    prepared,
  });
  if (!savedArtifacts.businessHtmlReport) {
    throw new Error("Deep Research primary business HTML report is missing.");
  }
  const businessHtmlReport = savedArtifacts.businessHtmlReport;

  return {
    ...savedArtifacts,
    fullCaseFileJson: fullCaseFileExports.fullCaseFileJson,
    fullCaseFileMarkdown: fullCaseFileExports.fullCaseFileMarkdown,
    businessHtmlReport,
    exportDir,
    status: "completed",
    failureReason: null,
  };
};
