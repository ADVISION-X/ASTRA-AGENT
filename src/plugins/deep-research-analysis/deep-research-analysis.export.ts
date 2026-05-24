import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { stableJsonHash } from "../../lib/storage/hash.js";
import { type DeepResearchBusinessDeckOutline } from "./deep-research-analysis.deck-schema.js";
import {
  generateDeepResearchBusinessDeckPptx,
} from "./deep-research-analysis.deck-pptx.js";
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
  decisionPackage: ResearchExport;
  businessDeckOutline: ResearchExport | null;
  businessDeckPptx: ResearchExport | null;
  evidenceIndex: ResearchExport;
  exportDir: string;
  status: "completed" | "deck_export_partial";
  failureReason: string | null;
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

const buildEvidenceIndexEntries = (input: {
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalReportRecord: ResearchFinalReportRecord | null;
  deckOutlineExport: ResearchExport | null;
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
      return;
    }
    if (
      interaction.phase === "deck"
      && input.deckOutlineExport
    ) {
      entries.push({ ...base, parsedRecordId: input.deckOutlineExport.id });
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

const buildDecisionPackage = (input: {
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

const buildBinaryHash = (value: Uint8Array): string =>
  "sha256:" + createHash("sha256").update(value).digest("hex");

const loadPersistedDeckOutline = (input: {
  persisted: DeepResearchPersistedExportState;
}): {
  exportRecord: ResearchExport;
  outline: DeepResearchBusinessDeckOutline;
} | null => {
  const outlineExport = input.persisted.exports.find((record) => record.exportKind === "business-deck-outline.json");
  if (!outlineExport) {
    return null;
  }
  const outline = JSON.parse(readFileSync(outlineExport.filePath, "utf8")) as DeepResearchBusinessDeckOutline;
  return {
    exportRecord: outlineExport,
    outline,
  };
};

type DeepResearchPreparedExportArtifacts = {
  persisted: DeepResearchPersistedExportState;
  finalReportMarkdownText: string;
  finalReportArtifact: { filePath: string; fileHash: string };
  decisionPackage: ReturnType<typeof buildDecisionPackage>;
  decisionPackageArtifact: { filePath: string; fileHash: string };
  persistedDeckOutline: {
    exportRecord: ResearchExport;
    outline: DeepResearchBusinessDeckOutline;
  } | null;
  evidenceIndex: DeepResearchEvidenceIndexEntry[];
  evidenceIndexArtifact: { filePath: string; fileHash: string };
};

const prepareExportArtifacts = (input: {
  persisted: DeepResearchPersistedExportState;
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
  exportDir: string;
  finalReportMarkdownText: string;
}): DeepResearchPreparedExportArtifacts => {
  const persistedFinalReport = input.persisted.finalReportRecord?.report ?? input.finalReport;
  const finalReportArtifact = writeTextArtifact(path.join(input.exportDir, "final-report.md"), input.finalReportMarkdownText);
  const decisionPackage = buildDecisionPackage({
    finalPackage: input.finalPackage,
    finalReport: persistedFinalReport,
  });
  const decisionPackageArtifact = writeJsonArtifact(path.join(input.exportDir, "decision-package.json"), decisionPackage);
  const persistedDeckOutline = loadPersistedDeckOutline({ persisted: input.persisted });
  const evidenceIndex = buildEvidenceIndexEntries({
    interactions: input.persisted.interactions,
    subQuestions: input.persisted.subQuestions,
    answers: input.persisted.answers,
    finalReportRecord: input.persisted.finalReportRecord,
    deckOutlineExport: persistedDeckOutline?.exportRecord ?? null,
  });
  const evidenceIndexArtifact = writeJsonArtifact(path.join(input.exportDir, "evidence-index.json"), evidenceIndex);
  return {
    persisted: input.persisted,
    finalReportMarkdownText: input.finalReportMarkdownText,
    finalReportArtifact,
    decisionPackage,
    decisionPackageArtifact,
    persistedDeckOutline,
    evidenceIndex,
    evidenceIndexArtifact,
  };
};

const persistBusinessDeckPptx = async (input: {
  exportDir: string;
  jobId: string;
  store: DeepResearchRecordStore;
  persistedDeckOutline: {
    exportRecord: ResearchExport;
    outline: DeepResearchBusinessDeckOutline;
  } | null;
}): Promise<Pick<DeepResearchExportArtifacts, "businessDeckPptx" | "status" | "failureReason">> => {
  if (!input.persistedDeckOutline) {
    return {
      businessDeckPptx: null,
      status: "completed",
      failureReason: null,
    };
  }
  try {
    const pptxFilePath = await generateDeepResearchBusinessDeckPptx({
      outputDir: input.exportDir,
      outline: input.persistedDeckOutline.outline,
    });
    const pptxBuffer = readFileSync(pptxFilePath);
    return {
      businessDeckPptx: input.store.saveExport({
        jobId: input.jobId,
        exportKind: "business-deck.pptx",
        filePath: pptxFilePath,
        fileHash: buildBinaryHash(pptxBuffer),
        payload: {
          slideCount: input.persistedDeckOutline.outline.slides.length,
          outlineExportId: input.persistedDeckOutline.exportRecord.id,
          warnings: input.persistedDeckOutline.outline.deckWarnings,
        },
      }),
      status: "completed",
      failureReason: null,
    };
  } catch (error) {
    return {
      businessDeckPptx: null,
      status: "deck_export_partial",
      failureReason: error instanceof Error ? error.message : "pptx_generation_failed",
    };
  }
};

const savePreparedExportRecords = (input: {
  jobId: string;
  store: DeepResearchRecordStore;
  prepared: DeepResearchPreparedExportArtifacts;
}): Pick<DeepResearchExportArtifacts, "finalReportMarkdown" | "decisionPackage" | "businessDeckOutline" | "evidenceIndex"> => ({
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
  decisionPackage: input.store.saveExport({
    jobId: input.jobId,
    exportKind: "decision-package.json",
    filePath: input.prepared.decisionPackageArtifact.filePath,
    fileHash: input.prepared.decisionPackageArtifact.fileHash,
    payload: input.prepared.decisionPackage,
  }),
  businessDeckOutline: input.prepared.persistedDeckOutline?.exportRecord ?? null,
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
  finalPackage: DeepResearchFinalPackage;
  finalReport: DeepResearchFinalReport;
}): Promise<DeepResearchExportArtifacts> => {
  const exportDir = buildExportDir(input.dataDir, input.jobId);
  mkdirSync(exportDir, { recursive: true });
  const persisted = loadPersistedExportState(input.store, input.jobId);
  const finalReport = persisted.finalReportRecord?.report ?? input.finalReport;
  const finalReportMarkdownText = buildDeepResearchFullFlowReportMarkdown({
    finalPackage: input.finalPackage,
    finalReport: finalReport,
    persisted: persisted,
  });
  const prepared = prepareExportArtifacts({
    persisted,
    finalPackage: input.finalPackage,
    finalReport: input.finalReport,
    exportDir,
    finalReportMarkdownText,
  });
  const deckExport = await persistBusinessDeckPptx({
    exportDir,
    jobId: input.jobId,
    store: input.store,
    persistedDeckOutline: prepared.persistedDeckOutline,
  });
  const savedArtifacts = savePreparedExportRecords({
    jobId: input.jobId,
    store: input.store,
    prepared,
  });

  return {
    ...savedArtifacts,
    businessDeckPptx: deckExport.businessDeckPptx,
    exportDir,
    status: deckExport.status,
    failureReason: deckExport.failureReason,
  };
};