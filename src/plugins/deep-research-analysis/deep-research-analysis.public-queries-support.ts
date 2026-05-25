import { existsSync } from "node:fs";

import {
  buildDeepResearchStructuredIndex,
  type DeepResearchStructuredIndex,
} from "./deep-research-analysis.structured-index.js";
import {
  createDeepResearchRecordStore,
  type ResearchAnswer,
  type ResearchExport,
  type ResearchInteraction,
  type ResearchJob,
  type ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";
import {
  type DeepResearchJobSnapshot,
  type DeepResearchPrimaryBusinessReportView,
  type DeepResearchReportViewModel,
  type DeepResearchTimelineEntry,
  type DeepResearchTimelineSnapshot,
} from "./deep-research-analysis.public-contracts.js";
import {
  buildParsedEntry,
  buildPromptText,
} from "./deep-research-analysis.public-prompt-support.js";
import {
  buildAnswerByKindAndSubQuestionId,
  buildConclusionView,
  buildEvidenceViews,
  buildReportExportViews,
  buildReportJobView,
  buildReportSubQuestionViews,
  buildStageViews,
  buildSubQuestionReports,
  buildTimelineByPhaseAndSubQuestionId,
} from "./deep-research-analysis.public-report-support.js";

const withStore = <T>(
  dataDir: string,
  action: (store: ReturnType<typeof createDeepResearchRecordStore>) => T,
): T => {
  const store = createDeepResearchRecordStore(dataDir);
  try {
    return action(store);
  } finally {
    store.close();
  }
};

const inferDefaultFlowPhase = (input: {
  subQuestions: readonly ResearchSubQuestion[];
  analysisAnswers: readonly ResearchAnswer[];
  finalReport: DeepResearchFinalReport | null;
}): DeepResearchPhase => {
  if (input.analysisAnswers.length < input.subQuestions.length) {
    return "ANALYSIS_PERSIST";
  }
  return input.finalReport ? "FINAL_ADJUDICATION_PERSIST" : "FULL_CASE_FILE_BUILD";
};

const inferCurrentPhase = (input: {
  job: ResearchJob;
  subQuestions: readonly ResearchSubQuestion[];
  analysisAnswers: readonly ResearchAnswer[];
  finalReport: DeepResearchFinalReport | null;
  exports: readonly ResearchExport[];
}): DeepResearchPhase => {
  if (input.job.status !== "queued") {
    return input.job.phase;
  }
  if (input.exports.length > 0) {
    return "EXPORT_REPORT";
  }
  if (input.subQuestions.length === 0) {
    return "DECOMPOSE_PARSE";
  }
  return inferDefaultFlowPhase({
    subQuestions: input.subQuestions,
    analysisAnswers: input.analysisAnswers,
    finalReport: input.finalReport,
  });
};

const buildJobSnapshot = (input: {
  job: ResearchJob;
  interactions: readonly ResearchInteraction[];
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalReport: DeepResearchFinalReport | null;
  exports: readonly ResearchExport[];
}): DeepResearchJobSnapshot => {
  const analysisAnswers = input.answers.filter((record) => record.answerKind === "analysis");
  return {
    job: input.job,
    overview: {
      currentPhase: inferCurrentPhase({
        job: input.job,
        subQuestions: input.subQuestions,
        analysisAnswers,
        finalReport: input.finalReport,
        exports: input.exports,
      }),
      interactionCount: input.interactions.length,
      subQuestionCount: input.subQuestions.length,
      analysisCount: analysisAnswers.length,
      exportCount: input.exports.length,
    },
    finalReport: input.finalReport,
    exports: [...input.exports],
  };
};

const buildTimelineEntries = (input: {
  interactions: readonly ResearchInteraction[];
  job: ResearchJob;
  subQuestions: readonly ResearchSubQuestion[];
  answers: readonly ResearchAnswer[];
  finalPackage: DeepResearchStructuredIndex | null;
  finalReportRecord: { id: string; report: DeepResearchFinalReport } | null;
}): DeepResearchTimelineEntry[] => {
  const subQuestionById = new Map(input.subQuestions.map((record) => [record.id, record]));
  const answersByInteractionId = new Map(
    input.answers.map((record) => [record.interactionId, record]),
  );
  return input.interactions.map((interaction): DeepResearchTimelineEntry => {
    const prompt = buildPromptText({
      job: input.job,
      interaction,
      subQuestionById,
      finalPackage: input.finalPackage,
    });
    const parsed = buildParsedEntry({
      interaction,
      subQuestions: input.subQuestions,
      answersByInteractionId,
      finalReportRecord: input.finalReportRecord,
    });
    return {
      interactionId: interaction.id,
      phase: interaction.phase,
      subQuestionId: interaction.subQuestionId,
      promptId: interaction.promptId,
      promptVersion: interaction.promptVersion,
      promptHash: interaction.promptHash,
      rawResponseHash: interaction.rawResponseHash,
      promptText: prompt.promptText,
      rawResponseText: interaction.rawResponseText,
      parsedSummary: parsed.parsedSummary,
      parsedJson: parsed.parsedJson,
      parsedRecordIds: parsed.parsedRecordIds,
      createdAt: interaction.createdAt,
      domRef: interaction.domRef,
      providerKind: interaction.providerKind,
      providerProofJson: interaction.providerProofJson,
      promptReconstructionStatus: prompt.promptReconstructionStatus,
    };
  });
};

const buildReaderStructuredIndex = (input: {
  store: ReturnType<typeof createDeepResearchRecordStore>;
  jobId: string;
  interactions: readonly ResearchInteraction[];
}): DeepResearchStructuredIndex | null => {
  if (!input.interactions.some((record) => record.phase === "final_adjudication")) {
    return null;
  }
  if (!input.store.getResearchPlan(input.jobId)) {
    return null;
  }
  return buildDeepResearchStructuredIndex({
    store: input.store,
    jobId: input.jobId,
  });
};

export const buildTimelineSnapshot = (dataDir: string, jobId: string): DeepResearchTimelineSnapshot | null =>
  withStore(dataDir, (store) => {
    const job = store.getJob(jobId);
    if (!job) {
      return null;
    }
    const interactions = store.listInteractions(jobId);
    const subQuestions = store.listSubQuestions(jobId);
    const answers = store.listAnswers({ jobId });
    const finalReportRecord = store.getLatestFinalReport(jobId);
    const exports = store.listExports(jobId);
    const finalPackage = buildReaderStructuredIndex({ store, jobId, interactions });
    const timeline = buildTimelineEntries({
      interactions,
      job,
      subQuestions,
      answers,
      finalPackage,
      finalReportRecord: finalReportRecord
        ? { id: finalReportRecord.id, report: finalReportRecord.report }
        : null,
    });
    return {
      job,
      overview: buildJobSnapshot({
        job,
        interactions,
        subQuestions,
        answers,
        finalReport: finalReportRecord?.report ?? null,
        exports,
      }).overview,
      timeline,
      subQuestions,
      answers,
      finalReport: finalReportRecord?.report ?? null,
      exports,
    };
  });

export const buildJobSnapshotForId = (dataDir: string, jobId: string): DeepResearchJobSnapshot | null =>
  withStore(dataDir, (store) => {
    const job = store.getJob(jobId);
    if (!job) {
      return null;
    }
    const interactions = store.listInteractions(jobId);
    const subQuestions = store.listSubQuestions(jobId);
    const answers = store.listAnswers({ jobId });
    const finalReport = store.getLatestFinalReport(jobId)?.report ?? null;
    const exports = store.listExports(jobId);
    return buildJobSnapshot({
      job,
      interactions,
      subQuestions,
      answers,
      finalReport,
      exports,
    });
  });

export const buildReportSubQuestionState = (snapshot: DeepResearchTimelineSnapshot) => {
  const subQuestions = buildReportSubQuestionViews(snapshot.subQuestions);
  const subQuestionById = new Map(subQuestions.map((record) => [record.id, record]));
  const timelineByPhaseAndSubQuestionId = buildTimelineByPhaseAndSubQuestionId(snapshot.timeline);
  const answerByKindAndSubQuestionId = buildAnswerByKindAndSubQuestionId(snapshot.answers);
  const subQuestionReports = buildSubQuestionReports({
    subQuestions,
    timelineByPhaseAndSubQuestionId,
    answerByKindAndSubQuestionId,
  });
  return {
    subQuestions,
    subQuestionById,
    answerByKindAndSubQuestionId,
    subQuestionReports,
  };
};

const readExportPayload = (record: ResearchExport | null): Record<string, unknown> | null => {
  if (!record) {
    return null;
  }
  try {
    const parsed = JSON.parse(record.payloadJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const selectBusinessHtmlExport = (
  exports: DeepResearchTimelineSnapshot["exports"],
): ResearchExport | null =>
  exports.find((entry) => entry.exportKind === "business-report.html") ?? null;

export const buildPrimaryBusinessReportView = (input: {
  job: DeepResearchTimelineSnapshot["job"];
  exports: DeepResearchTimelineSnapshot["exports"];
  exportViews: ReturnType<typeof buildReportExportViews>;
}): DeepResearchPrimaryBusinessReportView => {
  const htmlExport = selectBusinessHtmlExport(input.exports);
  const htmlExportView = input.exportViews.find((entry) => entry.exportKind === "business-report.html") ?? null;
  const payload = readExportPayload(htmlExport);
  const sourceKind = payload?.sourceKind === "html_artifact"
    ? payload.sourceKind
    : null;
  return {
    generatedAt: htmlExportView?.createdAt ?? null,
    status: htmlExportView
      ? "generated"
      : input.job.status === "failed" || input.job.status === "review_required"
        ? "failed"
        : "missing",
    generatedBy: "AI HTML Report Publisher" as const,
    htmlExport: htmlExportView,
    sourceKind,
  };
};
