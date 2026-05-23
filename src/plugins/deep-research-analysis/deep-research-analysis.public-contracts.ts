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
  scope: string;
  expectedAnswerShape: string;
};

export type DeepResearchAnswerBlockView = {
  interaction: DeepResearchReportInteractionView | null;
  answerText: string;
  preview: string;
  confidence: ResearchAnswer["confidence"];
  keyPoints: string[];
  evidenceMentions: string[];
  assumptions: string[];
  limitations: string[];
  contradictionPoints: string[];
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
};

export type DeepResearchConclusionView = {
  executiveConclusion: string;
  confidence: DeepResearchFinalReport["confidence"];
  positiveReasons: string[];
  strongestOpposingArguments: string[];
  evidenceGaps: string[];
  reverseConditions: string[];
  followUpSignals: string[];
  limitations: string[];
};

export type DeepResearchReportViewModel = {
  job: {
    id: string;
    title: string;
    userQuestion: string;
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
  };
  conclusion: DeepResearchConclusionView | null;
  stages: DeepResearchStageView[];
  decomposition: {
    interaction: DeepResearchReportInteractionView | null;
    subQuestions: DeepResearchSubQuestionView[];
  };
  subQuestionReports: Array<{
    subQuestion: DeepResearchSubQuestionView;
    positive: DeepResearchAnswerBlockView | null;
    falsification: DeepResearchAnswerBlockView | null;
    conflict: DeepResearchConflictMatrixRowView | null;
  }>;
  finalSynthesis: {
    interaction: DeepResearchReportInteractionView | null;
    parsedFinalReport: DeepResearchFinalReport | null;
  };
  evidence: DeepResearchEvidenceView[];
  exports: DeepResearchExportView[];
};
