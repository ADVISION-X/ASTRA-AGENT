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
} from "./deep-research-analysis.final-package.js";
import type {
  DeepResearchRecordStore,
  ResearchExport,
  ResearchFinalReportRecord,
  ResearchInteraction,
  ResearchSubQuestion,
  ResearchAnswer,
} from "./deep-research-analysis.records.js";
import { buildDeepResearchPromptBundleExport } from "./deep-research-analysis.research-plan-persist.js";

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
  researchPlan: ResearchExport;
  promptBundles: ResearchExport;
  decisionPackage: ResearchExport;
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

const DECISION_PACKAGE_EXPORT_KIND = "decision-package.json";

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

const buildDecisionPackage = (input: {
  finalPackage: DeepResearchStructuredIndex;
  finalReport: DeepResearchFinalReport;
}) => ({
  jobId: input.finalPackage.jobId,
  userQuestion: input.finalPackage.userQuestion,
  analysisGoal: input.finalPackage.analysisGoal,
  promptVersions: input.finalPackage.promptVersions,
  subQuestions: input.finalPackage.decompositionRecords,
  analysisAnswers: input.finalPackage.analysisRecords,
  analysisCoverage: input.finalPackage.analysisCoverage,
  missingAnalysisSubQuestionIds: input.finalPackage.missingAnalysisSubQuestionIds,
  finalReport: input.finalReport,
  researchPlan: input.finalPackage.researchPlan,
  promptBundles: input.finalPackage.promptBundles,
  recordHashes: input.finalPackage.recordHashes,
});

type DeepResearchPreparedExportArtifacts = {
  persisted: DeepResearchPersistedExportState;
  finalReportMarkdownText: string;
  finalReportArtifact: { filePath: string; fileHash: string };
  decisionPackage: ReturnType<typeof buildDecisionPackage>;
  decisionPackageArtifact: { filePath: string; fileHash: string };
  researchPlanArtifact: { filePath: string; fileHash: string };
  promptBundlesArtifact: { filePath: string; fileHash: string };
  promptBundles: ReturnType<typeof buildDeepResearchPromptBundleExport>;
  businessHtmlExport: ResearchExport | null;
  evidenceIndex: DeepResearchEvidenceIndexEntry[];
  evidenceIndexArtifact: { filePath: string; fileHash: string };
};

const prepareExportArtifacts = (input: {
  persisted: DeepResearchPersistedExportState;
  finalPackage: DeepResearchStructuredIndex;
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
  const decisionPackageArtifact = writeJsonArtifact(
    path.join(input.exportDir, DECISION_PACKAGE_EXPORT_KIND),
    decisionPackage,
  );
  const researchPlanArtifact = writeJsonArtifact(
    path.join(input.exportDir, "research-plan.json"),
    input.finalPackage.researchPlan,
  );
  const promptBundles = buildDeepResearchPromptBundleExport({
    researchPlan: input.finalPackage.researchPlan,
    subQuestions: input.finalPackage.decompositionRecords,
  });
  const promptBundlesArtifact = writeJsonArtifact(
    path.join(input.exportDir, "prompt-bundles.json"),
    promptBundles,
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
    finalReportMarkdownText: input.finalReportMarkdownText,
    finalReportArtifact,
    decisionPackage,
    decisionPackageArtifact,
    researchPlanArtifact,
    promptBundlesArtifact,
    promptBundles,
    businessHtmlExport,
    evidenceIndex,
    evidenceIndexArtifact,
  };
};

const savePreparedExportRecords = (input: {
  jobId: string;
  store: DeepResearchRecordStore;
  prepared: DeepResearchPreparedExportArtifacts;
}): Pick<DeepResearchExportArtifacts, "finalReportMarkdown" | "decisionPackage" | "researchPlan" | "promptBundles" | "evidenceIndex"> & {
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
  decisionPackage: input.store.saveExport({
    jobId: input.jobId,
    exportKind: DECISION_PACKAGE_EXPORT_KIND,
    filePath: input.prepared.decisionPackageArtifact.filePath,
    fileHash: input.prepared.decisionPackageArtifact.fileHash,
    payload: input.prepared.decisionPackage,
  }),
  researchPlan: input.store.saveExport({
    jobId: input.jobId,
    exportKind: "research-plan.json",
    filePath: input.prepared.researchPlanArtifact.filePath,
    fileHash: input.prepared.researchPlanArtifact.fileHash,
    payload: input.prepared.decisionPackage.researchPlan,
  }),
  promptBundles: input.store.saveExport({
    jobId: input.jobId,
    exportKind: "prompt-bundles.json",
    filePath: input.prepared.promptBundlesArtifact.filePath,
    fileHash: input.prepared.promptBundlesArtifact.fileHash,
    payload: input.prepared.promptBundles,
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
  finalPackage: DeepResearchStructuredIndex;
  fullCaseFile?: DeepResearchFullCaseFile;
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
  const fullCaseFileExports = saveFullCaseFileExports({
    store: input.store,
    jobId: input.jobId,
    exportDir,
    fullCaseFile: input.fullCaseFile ?? buildDeepResearchFullCaseFile({
      store: input.store,
      jobId: input.jobId,
      structuredIndex: input.finalPackage,
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
