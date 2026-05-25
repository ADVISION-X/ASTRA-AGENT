import type {
  ResearchAnswer,
  ResearchExport,
  ResearchInteraction,
  ResearchJob,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchFinalAdjudicationRecord } from "./deep-research-analysis.result.js";
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
    exportCount: number;
  };
  finalAdjudication: DeepResearchFinalAdjudicationRecord | null;
  exports: ResearchExport[];
};

export type DeepResearchTimelineSnapshot = {
  job: ResearchJob;
  overview: DeepResearchJobSnapshot["overview"];
  timeline: DeepResearchTimelineEntry[];
  subQuestions: ResearchSubQuestion[];
  answers: ResearchAnswer[];
  finalAdjudication: DeepResearchFinalAdjudicationRecord | null;
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
  finalAdjudicationPreview: string | null;
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
  keyPoints: string[];
  evidenceMentions: string[];
  assumptions: string[];
  limitations: string[];
  contradictionPoints: string[];
  parsedPayload: ResearchAnswer["parsedPayload"];
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

export type DeepResearchPrimaryBusinessReportView = {
  generatedAt: string | null;
  status: "generated" | "missing" | "failed";
  generatedBy: "AI HTML Report Publisher";
  htmlExport: DeepResearchExportView | null;
  sourceKind: "html_artifact" | "inline_html_document" | null;
};

export type DeepResearchConclusionView = {
  rawFinalAnswerText: string;
  preferredFormat: DeepResearchFinalAdjudicationRecord["preferredFormat"];
  parseStatus: DeepResearchFinalAdjudicationRecord["parseStatus"];
  parsedJsonIndex: DeepResearchFinalAdjudicationRecord["parsedJsonIndex"];
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
    analysis: DeepResearchAnswerBlockView | null;
  }>;
  finalAdjudication: {
    interaction: DeepResearchReportInteractionView | null;
    record: DeepResearchFinalAdjudicationRecord | null;
  };
  primaryBusinessReport: DeepResearchPrimaryBusinessReportView | null;
  evidence: DeepResearchEvidenceView[];
  exports: DeepResearchExportView[];
};
