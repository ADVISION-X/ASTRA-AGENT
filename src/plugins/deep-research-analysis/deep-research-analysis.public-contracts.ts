import type {
  ResearchAnswer,
  ResearchExport,
  ResearchInteraction,
  ResearchJob,
  ResearchSubQuestion,
} from "./deep-research-analysis.records.js";
import type { DeepResearchPromptBundle } from "./deep-research-analysis.prompt-bundle-schema.js";
import type { DeepResearchPlan } from "./deep-research-analysis.research-plan-schema.js";
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
  parseStatus: ResearchInteraction["parseStatus"];
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
  researchPlan: DeepResearchPlan | null;
  timeline: DeepResearchTimelineEntry[];
  subQuestions: ResearchSubQuestion[];
  answers: ResearchAnswer[];
  finalAdjudication: DeepResearchFinalAdjudicationRecord | null;
  exports: ResearchExport[];
};

export type DeepResearchPromptBundleView = DeepResearchPromptBundle;

export type DeepResearchHistoryHtmlReportStatus = "generated" | "missing" | "failed";

export type DeepResearchHistoryFullCaseFileStatus = "generated" | "missing";

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
  htmlReportStatus: DeepResearchHistoryHtmlReportStatus | null;
  fullCaseFileStatus: DeepResearchHistoryFullCaseFileStatus | null;
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
  promptBundle: DeepResearchPromptBundleView;
  analysisStatus: string | null;
  parseStatus: string | null;
};

export type DeepResearchAnswerBlockView = {
  interaction: DeepResearchReportInteractionView | null;
  answerKind: ResearchAnswer["answerKind"];
  answerText: string;
  preview: string;
  indexNotes: string[];
  keyPoints: string[];
  evidenceMentions: string[];
  assumptions: string[];
  limitations: string[];
  contradictionPoints: string[];
  parsedPayload: ResearchAnswer["parsedPayload"];
  parsedJsonIndex: unknown | null;
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
  promptHashes: string[];
  rawResponseHashes: string[];
  parseStatuses: string[];
  recordCount: number;
  failureReason: string | null;
  reviewReason: string | null;
};

export type DeepResearchResearchPlanView = {
  interaction: DeepResearchReportInteractionView | null;
  mainQuestion: string;
  questionType: DeepResearchPlan["questionType"];
  decompositionStrategy: string;
  subQuestions: DeepResearchSubQuestionView[];
  finalAdjudicationPromptBundle: DeepResearchPromptBundleView | null;
  htmlReportPromptBundle: DeepResearchPromptBundleView | null;
  planIntegrityCheck: DeepResearchPlan["planIntegrityCheck"] | null;
};

export type DeepResearchFullCaseFileSummaryView = {
  hasMarkdown: boolean;
  hasJson: boolean;
  decompositionRawPresent: boolean;
  analysisRawCount: number;
  subQuestionCount: number;
  finalRawPresent: boolean;
  htmlReportPresent: boolean;
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
  sourceKind: "html_artifact" | null;
  failureReason: string | null;
  reviewReason: string | null;
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
  researchPlan: DeepResearchResearchPlanView | null;
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
  fullCaseFileSummary: DeepResearchFullCaseFileSummaryView;
  evidence: DeepResearchEvidenceView[];
  exports: DeepResearchExportView[];
};
