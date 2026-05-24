import type {
  ResearchAnswer,
  ResearchConflictMatrix,
  ResearchExport,
  ResearchInteraction,
  ResearchJob,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchFinalReport } from "./deep-research-analysis.result.js";
import type { DeepResearchPhase } from "./deep-research-analysis.schema.js";

export type PromptReconstructionStatus = "verified" | "hash_mismatch" | "unavailable";

export type DeepResearchTimelineEntry = {
  interactionId: string;
  phase: ResearchInteraction["phase"];
  subQuestionId: string | null;
  promptId: string;
  promptVersion: string;
  promptHash: string;
  rawResponseHash: string;
  promptText: string | null;
  rawResponseText: string;
  parsedSummary: string;
  parsedJson: unknown;
  parsedRecordIds: string[];
  createdAt: string;
  domRef: string | null;
  providerKind: ResearchInteraction["providerKind"];
  providerProofJson: string | null;
  promptReconstructionStatus: PromptReconstructionStatus;
};

export type DeepResearchJobSnapshot = {
  job: ResearchJob;
  overview: {
    currentPhase: DeepResearchPhase;
    interactionCount: number;
    subQuestionCount: number;
    analysisCount: number;
    positiveCount: number;
    falsificationCount: number;
    exportCount: number;
  };
  finalReport: DeepResearchFinalReport | null;
  exports: ResearchExport[];
};

export type DeepResearchTimelineSnapshot = {
  job: ResearchJob;
  overview: DeepResearchJobSnapshot["overview"];
  timeline: DeepResearchTimelineEntry[];
  subQuestions: ResearchSubQuestion[];
  answers: ResearchAnswer[];
  conflictMatrix: ResearchConflictMatrix[];
  finalReport: DeepResearchFinalReport | null;
  exports: ResearchExport[];
};

export type DeepResearchHistoryJobView = {
  id: string;
  title: string;
  userQuestion: string;
  questionSummary: string;
  analysisGoal: string | null;
  status: ResearchJob["status"];
  phase: ResearchJob["phase"];
  failureReason: string | null;
  reviewReason: string | null;
  createdAt: string;
  updatedAt: string;
  subQuestionCount: number;
  interactionCount: number;
  exportCount: number;
  finalConfidence: DeepResearchFinalReport["confidence"] | null;
  finalConclusionPreview: string | null;
};

export type DeepResearchHistorySnapshot = {
  jobs: DeepResearchHistoryJobView[];
};

type DeepResearchReportInteractionView = DeepResearchTimelineEntry;

export type DeepResearchSubQuestionView = {
  id: string;
  modelQuestionId: string;
  ordinal: number;
  title: string;
  questionText: string;
  purpose: string;
  whyItMatters: string | null;
  decisionWeight: ResearchSubQuestion["question"]["decisionWeight"] | null;
  analysisFocus: string | null;
  requiredEvidence: string[];
  scope: string;
  expectedAnswerShape: string;
  priority: ResearchSubQuestion["question"]["priority"] | null;
  omissionRisk: string | null;
};

export type DeepResearchAnswerBlockView = {
  interaction: DeepResearchReportInteractionView | null;
  answerKind: ResearchAnswer["answerKind"];
  answerText: string;
  preview: string;
  confidence: ResearchAnswer["confidence"];
  keyPoints: string[];
  evidenceMentions: string[];
  assumptions: string[];
  limitations: string[];
  contradictionPoints: string[];
  parsedPayload: ResearchAnswer["parsedPayload"];
};

type DeepResearchConflictMatrixRowView = ResearchConflictMatrix["row"] & {
  rowId: string;
  createdAt: string;
};

export type DeepResearchStageStatus =
  | "completed"
  | "running"
  | "pending"
  | "failed"
  | "review_required";

export type DeepResearchStageView = {
  id: string;
  label: string;
  anchorId: string;
  status: DeepResearchStageStatus;
};

export type DeepResearchEvidenceView = DeepResearchReportInteractionView & {
  headline: string;
  summary: string;
};

export type DeepResearchExportView = {
  exportKind: ResearchExport["exportKind"];
  label: string;
  fileName: string;
  filePath: string;
  fileHash: string;
  payloadHash: string;
  createdAt: string;
  fileSizeBytes: number | null;
};

export type DeepResearchBusinessDeckView = {
  generatedAt: string | null;
  status: "ai_generated" | "local_fallback" | "outline_only";
  generatedBy: "AI PPT Artifact" | "Local fallback" | "Deck outline only";
  outlineExport: DeepResearchExportView | null;
  pptxExport: DeepResearchExportView | null;
  deckTitle: string | null;
  deckSubtitle: string | null;
  audience: string | null;
  slideCount: number;
  warnings: string[];
  preservationSummary: {
    usedRankedConclusionCount: number;
    usedReverseConditionCount: number;
    usedEvidenceGapCount: number;
    usedReferenceCount: number;
    omittedItemCount: number;
  } | null;
  slideSummaries: Array<{
    slideNumber: number;
    slideType: string;
    title: string;
    headline: string;
  }>;
};

export type DeepResearchConclusionView = {
  directAnswer: string;
  finalVerdict: string;
  oneSentenceDecision: string;
  executiveConclusion: string;
  confidence: DeepResearchFinalReport["confidence"];
  rankedConclusions: DeepResearchFinalReport["rankedConclusions"];
  strongConclusions: string[];
  conditionalConclusions: string[];
  weakOrRejectedClaims: string[];
  decisiveReasons: string[];
  positiveReasons: string[];
  strongestOpposingArguments: string[];
  evidenceGaps: string[];
  reverseConditions: string[];
  applicability: string[];
  nonApplicability: string[];
  followUpSignals: string[];
  multiStageValueAdded: string[];
  limitations: string[];
  references: string[];
};

export type DeepResearchReportViewModel = {
  job: {
    id: string;
    title: string;
    userQuestion: string;
    analysisGoal: string | null;
    flowMode: ResearchJob["flowMode"];
    status: ResearchJob["status"];
    phase: ResearchJob["phase"];
    failureReason: string | null;
    reviewReason: string | null;
    createdAt: string;
    updatedAt: string;
    subQuestionCount: number;
    interactionCount: number;
    exportCount: number;
  };
  conclusion: DeepResearchConclusionView | null;
  stages: DeepResearchStageView[];
  decomposition: {
    interaction: DeepResearchReportInteractionView | null;
    subQuestions: DeepResearchSubQuestionView[];
  };
  subQuestionReports: Array<{
    subQuestion: DeepResearchSubQuestionView;
    analysis: DeepResearchAnswerBlockView | null;
    positive: DeepResearchAnswerBlockView | null;
    falsification: DeepResearchAnswerBlockView | null;
    conflict: DeepResearchConflictMatrixRowView | null;
  }>;
  finalAdjudication: {
    interaction: DeepResearchReportInteractionView | null;
    parsedFinalReport: DeepResearchFinalReport | null;
  };
  businessDeck: DeepResearchBusinessDeckView | null;
  evidence: DeepResearchEvidenceView[];
  exports: DeepResearchExportView[];
};
