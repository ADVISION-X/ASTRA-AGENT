import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableJsonHash } from "../../lib/storage/hash.js";
import { buildDeepResearchFullFlowReportMarkdown } from "./deep-research-analysis.export-markdown.js";
import type {
  DeepResearchFinalReport,
} from "./deep-research-analysis.result.js";
import type {
  DeepResearchFinalPackage,
} from "./deep-research-analysis.final-package.js";
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
  researchBundle: ResearchExport;
  evidenceIndex: ResearchExport;
  exportDir: string;
};

type DeepResearchPersistedExportState = {
  job: ReturnType<DeepResearchRecordStore["getJob"]> extends infer TJob | null ? TJob : never;
  finalReportRecord: ResearchFinalReportRecord | null;
  interactions: ResearchInteraction[];
  subQuestions: ResearchSubQuestion[];
  answers: ResearchAnswer[];
};

const buildTextHash = (value: string): string =>
  "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");

const buildExportDir = (dataDir: string, jobId: string): string =>
  path.join(dataDir, "deep-research-analysis", "exports", jobId);

const buildEvidenceIndexEntries = (input: {
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalReportRecord: ResearchFinalReportRecord | null;
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
    if (
      interaction.phase === "analysis"
      || interaction.phase === "positive"
      || interaction.phase === "falsification"
    ) {
      input.answers
        .filter((record) => record.interactionId === interaction.id)
        .forEach((record) => entries.push({ ...base, parsedRecordId: record.id }));
      return;
    }
    if (
      (interaction.phase === "final_adjudication" || interaction.phase === "final_synthesis")
      && input.finalReportRecord
      && input.finalReportRecord.interactionId === interaction.id
    ) {
      entries.push({ ...base, parsedRecordId: input.finalReportRecord.id });
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

const buildResearchBundle = (input: {
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
}) => ({
  jobId: input.finalPackage.jobId,
  userQuestion: input.finalPackage.userQuestion,
  analysisGoal: input.finalPackage.analysisGoal,
  flowMode: input.finalPackage.flowMode,
  promptVersions: input.finalPackage.promptVersions,
  subQuestions: input.finalPackage.decompositionRecords,
  analysisAnswers: input.finalPackage.analysisRecords,
  analysisCoverage: input.finalPackage.analysisCoverage,
  missingAnalysisSubQuestionIds: input.finalPackage.missingAnalysisSubQuestionIds,
  ...(input.finalPackage.flowMode === "legacy_1_n_n_1"
    ? {
      positiveAnswers: input.finalPackage.positiveAnswerRecords,
      falsificationAnswers: input.finalPackage.falsificationAnswerRecords,
      conflictMatrix: input.finalPackage.conflictMatrix,
      legacyMissingPositiveFalsificationSubQuestionIds:
        input.finalPackage.legacyMissingPositiveFalsificationSubQuestionIds,
    }
    : {}),
  finalReport: input.finalReport,
  recordHashes: input.finalPackage.recordHashes,
});

export const exportDeepResearchArtifacts = (input: {
  dataDir: string;
  store: DeepResearchRecordStore;
  jobId: string;
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
}): DeepResearchExportArtifacts => {
  const exportDir = buildExportDir(input.dataDir, input.jobId);
  mkdirSync(exportDir, { recursive: true });
  const persisted = loadPersistedExportState(input.store, input.jobId);

  const finalReportMarkdownText = buildDeepResearchFullFlowReportMarkdown({
    finalPackage: input.finalPackage,
    finalReport: persisted.finalReportRecord?.report ?? input.finalReport,
    persisted: persisted,
  });
  const finalReportArtifact = writeTextArtifact(path.join(exportDir, "final-report.md"), finalReportMarkdownText);

  const researchBundle = buildResearchBundle({
    finalPackage: input.finalPackage,
    finalReport: persisted.finalReportRecord?.report ?? input.finalReport,
  });
  const researchBundleArtifact = writeJsonArtifact(path.join(exportDir, "research-bundle.json"), researchBundle);

  const evidenceIndex = buildEvidenceIndexEntries({
    interactions: persisted.interactions,
    subQuestions: persisted.subQuestions,
    answers: persisted.answers,
    finalReportRecord: persisted.finalReportRecord,
  });
  const evidenceIndexArtifact = writeJsonArtifact(path.join(exportDir, "evidence-index.json"), evidenceIndex);

  return {
    finalReportMarkdown: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "final-report.md",
      filePath: finalReportArtifact.filePath,
      fileHash: finalReportArtifact.fileHash,
      payload: { finalReportHash: finalReportArtifact.fileHash, content: finalReportMarkdownText },
    }),
    researchBundle: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "research-bundle.json",
      filePath: researchBundleArtifact.filePath,
      fileHash: researchBundleArtifact.fileHash,
      payload: researchBundle,
    }),
    evidenceIndex: input.store.saveExport({
      jobId: input.jobId,
      exportKind: "evidence-index.json",
      filePath: evidenceIndexArtifact.filePath,
      fileHash: evidenceIndexArtifact.fileHash,
      payload: evidenceIndex,
    }),
    exportDir,
  };
};