import { existsSync, readFileSync } from "node:fs";

import {
  buildDeepResearchFinalPackage,
  type DeepResearchFinalPackage,
} from "./deep-research-analysis.final-package.js";
import type { DeepResearchBusinessDeckOutline } from "./deep-research-analysis.deck-schema.js";
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
  buildConflictBySubQuestionId,
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
  return input.finalReport ? "FINAL_ADJUDICATION_PERSIST" : "FINAL_PACKAGE_BUILD";
};

const inferLegacyFlowPhase = (input: {
  subQuestions: readonly ResearchSubQuestion[];
  positiveAnswers: readonly ResearchAnswer[];
  falsificationAnswers: readonly ResearchAnswer[];
  finalReport: DeepResearchFinalReport | null;
}): DeepResearchPhase => {
  if (input.finalReport) {
    return "FINAL_PERSIST";
  }
  if (input.positiveAnswers.length < input.subQuestions.length) {
    return "POSITIVE_PERSIST";
  }
  return input.falsificationAnswers.length < input.subQuestions.length
    ? "FALSIFY_PERSIST"
    : "FINAL_PACKAGE_BUILD";
};

const inferCurrentPhase = (input: {
  job: ResearchJob;
  subQuestions: readonly ResearchSubQuestion[];
  analysisAnswers: readonly ResearchAnswer[];
  positiveAnswers: readonly ResearchAnswer[];
  falsificationAnswers: readonly ResearchAnswer[];
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
  return input.job.flowMode === "default_1_n_1" || input.job.flowMode === "default_1_n_1_1"
    ? inferDefaultFlowPhase({
      subQuestions: input.subQuestions,
      analysisAnswers: input.analysisAnswers,
      finalReport: input.finalReport,
    })
    : inferLegacyFlowPhase({
      subQuestions: input.subQuestions,
      positiveAnswers: input.positiveAnswers,
      falsificationAnswers: input.falsificationAnswers,
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
  const positiveAnswers = input.answers.filter((record) => record.answerKind === "positive");
  const falsificationAnswers = input.answers.filter((record) => record.answerKind === "falsification");
  return {
    job: input.job,
    overview: {
      currentPhase: inferCurrentPhase({
        job: input.job,
        subQuestions: input.subQuestions,
        analysisAnswers,
        positiveAnswers,
        falsificationAnswers,
        finalReport: input.finalReport,
        exports: input.exports,
      }),
      interactionCount: input.interactions.length,
      subQuestionCount: input.subQuestions.length,
      analysisCount: analysisAnswers.length,
      positiveCount: positiveAnswers.length,
      falsificationCount: falsificationAnswers.length,
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
  positiveAnswerBySubQuestionId: Map<string, ResearchAnswer>;
  finalPackage: DeepResearchFinalPackage | null;
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
      positiveAnswerBySubQuestionId: input.positiveAnswerBySubQuestionId,
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

export const buildTimelineSnapshot = (dataDir: string, jobId: string): DeepResearchTimelineSnapshot | null =>
  withStore(dataDir, (store) => {
    const job = store.getJob(jobId);
    if (!job) {
      return null;
    }
    const interactions = store.listInteractions(jobId);
    const subQuestions = store.listSubQuestions(jobId);
    const answers = store.listAnswers({ jobId });
    const conflictMatrix = store.listConflictMatrix(jobId);
    const finalReportRecord = store.getLatestFinalReport(jobId);
    const exports = store.listExports(jobId);
    const positiveAnswerBySubQuestionId = new Map(
      answers
        .filter((record) => record.answerKind === "positive")
        .map((record) => [record.subQuestionId, record]),
    );
    const finalPackage = interactions.some((record) =>
      record.phase === "final_synthesis" || record.phase === "final_adjudication")
      ? buildDeepResearchFinalPackage({ store, jobId })
      : null;
    const timeline = buildTimelineEntries({
      interactions,
      job,
      subQuestions,
      answers,
      positiveAnswerBySubQuestionId,
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
      conflictMatrix,
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
  const conflictBySubQuestionId = buildConflictBySubQuestionId(snapshot.conflictMatrix);
  const subQuestionReports = buildSubQuestionReports({
    subQuestions,
    timelineByPhaseAndSubQuestionId,
    answerByKindAndSubQuestionId,
    conflictBySubQuestionId,
  });
  return {
    subQuestions,
    subQuestionById,
    answerByKindAndSubQuestionId,
    conflictBySubQuestionId,
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
}) => {
  const htmlExport = selectBusinessHtmlExport(input.exports);
  const htmlExportView = input.exportViews.find((entry) => entry.exportKind === "business-report.html") ?? null;
  const payload = readExportPayload(htmlExport);
  const sourceKind = payload?.sourceKind === "html_artifact" || payload?.sourceKind === "raw_html_text"
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

const selectBusinessDeckPptxExport = (
  exports: DeepResearchTimelineSnapshot["exports"],
): ResearchExport | null =>
  exports.find((entry) => entry.exportKind === "business-deck.ai-pptx")
  ?? exports.find((entry) => entry.exportKind === "business-deck.local-pptx")
  ?? exports.find((entry) => entry.exportKind === "business-deck.pptx")
  ?? null;

const resolveBusinessDeckStatus = (
  exportKind: ResearchExport["exportKind"] | null,
): Pick<NonNullable<DeepResearchReportViewModel["businessDeck"]>, "status" | "generatedBy"> => {
  if (exportKind === "business-deck.ai-pptx") {
    return { status: "ai_generated", generatedBy: "AI PPT Artifact" };
  }
  if (exportKind) {
    return { status: "local_fallback", generatedBy: "Local fallback" };
  }
  return { status: "outline_only", generatedBy: "Deck outline only" };
};

const buildBusinessDeckOutlineView = (deckOutline: DeepResearchBusinessDeckOutline | null) => ({
  deckTitle: deckOutline?.deckTitle ?? "Business PPT",
  deckSubtitle: deckOutline?.deckSubtitle ?? null,
  audience: deckOutline?.audience ?? null,
  slideCount: deckOutline?.slides.length ?? 0,
  warnings: deckOutline?.deckWarnings ?? [],
  preservationSummary: deckOutline ? {
    usedRankedConclusionCount: deckOutline.contentPreservationSummary.usedRankedConclusionCount,
    usedReverseConditionCount: deckOutline.contentPreservationSummary.usedReverseConditionCount,
    usedEvidenceGapCount: deckOutline.contentPreservationSummary.usedEvidenceGapCount,
    usedReferenceCount: deckOutline.contentPreservationSummary.usedReferenceCount,
    omittedItemCount: deckOutline.contentPreservationSummary.omittedItems.length,
  } : null,
  slideSummaries: (deckOutline?.slides ?? []).map((slide) => ({
    slideNumber: slide.slideNumber,
    slideType: slide.slideType,
    title: slide.title,
    headline: slide.headline,
  })),
});

export const buildBusinessDeckView = (input: {
  exports: DeepResearchTimelineSnapshot["exports"];
  exportViews: ReturnType<typeof buildReportExportViews>;
}) => {
  const outlineExport = input.exports.find((entry) => entry.exportKind === "business-deck-outline.json") ?? null;
  const pptxExport = selectBusinessDeckPptxExport(input.exports);
  const pptxView = pptxExport
    ? input.exportViews.find((entry) => entry.exportKind === pptxExport.exportKind) ?? null
    : null;
  const outlineView = input.exportViews.find((entry) => entry.exportKind === "business-deck-outline.json") ?? null;
  if (!outlineExport && !pptxExport) {
    return null;
  }
  const deckStatus = resolveBusinessDeckStatus(pptxExport?.exportKind ?? null);
  const deckOutline = outlineExport
    ? JSON.parse(readFileSync(outlineExport.filePath, "utf8")) as DeepResearchBusinessDeckOutline
    : null;
  return {
    generatedAt: pptxExport?.createdAt ?? outlineExport?.createdAt ?? null,
    ...deckStatus,
    outlineExport: outlineView,
    pptxExport: pptxView,
    ...buildBusinessDeckOutlineView(deckOutline),
  };
};
