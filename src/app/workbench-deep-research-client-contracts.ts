export type DeepResearchListOptions = {
  emptyText?: string;
  previewCount?: number;
};

export type DeepResearchTextOptions = {
  emptyText?: string;
  previewLimit?: number;
  forceDetails?: boolean;
  summaryLabel?: string;
  className?: string;
};

type DeepResearchHistoryJob = {
  id: string;
  title: string;
  userQuestion: string;
  questionSummary: string;
  analysisGoal: string | null;
  status: string;
  phase: string;
  failureReason: string | null;
  reviewReason: string | null;
  createdAt: string;
  finalAdjudicationPreview: string | null;
  updatedAt: string;
  subQuestionCount: number;
  interactionCount: number;
  exportCount: number;
  htmlReportStatus: string | null;
  fullCaseFileStatus: string | null;
};

export type DeepResearchHistoryPayload = {
  jobs: DeepResearchHistoryJob[];
};

export type DeepResearchInteraction = {
  interactionId: string;
  phase: string;
  promptText: string | null;
  rawResponseText: string;
  parseStatus: string;
  parsedJson: unknown;
  parsedSummary: string;
  createdAt: string;
  promptHash: string;
  rawResponseHash: string;
  domRef: string | null;
  providerKind: string | null;
  providerProofJson: string | null;
  parsedRecordIds: string[];
};

export type DeepResearchPromptBundleView = {
  promptBundleId: string;
  promptRole: string;
  taskInstruction: string;
  questionSpecificFocus: string[];
  mustUseInputs: string[];
  mustNotDo: string[];
  evidenceOrReasoningNeeds: string[];
  outputGuidance: {
    preferredFormat: string;
    requiredContent: string[];
    supplementalContent: string[];
    forbiddenContent: string[];
  };
  safetyBoundary: string[];
  languageInstruction: string;
};

type DeepResearchSubQuestion = {
  id: string;
  ordinal: number;
  title: string;
  questionText: string;
  purpose: string;
  whyItMatters: string | null;
  decisionWeight: string | null;
  analysisFocus: string | null;
  requiredEvidence: string[];
  scope: string;
  expectedAnswerShape: string;
  priority: string | null;
  omissionRisk: string | null;
  promptBundle: DeepResearchPromptBundleView;
  analysisStatus: string | null;
  parseStatus: string | null;
};

export type DeepResearchAnswerBlock = {
  interaction: DeepResearchInteraction | null;
  answerKind: string;
  answerText: string;
  indexNotes: string[];
  keyPoints: string[];
  evidenceMentions: string[];
  assumptions: string[];
  limitations: string[];
  contradictionPoints: string[];
  parsedPayload: Record<string, unknown>;
  parsedJsonIndex: unknown | null;
};

type DeepResearchSubQuestionReport = {
  subQuestion: DeepResearchSubQuestion;
  analysis: DeepResearchAnswerBlock | null;
};

type DeepResearchConclusion = {
  rawFinalAnswerText: string;
  preferredFormat: string;
  parseStatus: string;
  parsedJsonIndex: unknown | null;
};

type DeepResearchStage = {
  id: string;
  label: string;
  anchorId: string;
  status: string;
  promptHashes: string[];
  rawResponseHashes: string[];
  parseStatuses: string[];
  recordCount: number;
  failureReason: string | null;
  reviewReason: string | null;
};

export type DeepResearchResearchPlanView = {
  interaction: DeepResearchInteraction | null;
  mainQuestion: string;
  questionType: string;
  decompositionStrategy: string;
  subQuestions: DeepResearchSubQuestion[];
  finalAdjudicationPromptBundle: DeepResearchPromptBundleView | null;
  htmlReportPromptBundle: DeepResearchPromptBundleView | null;
  planIntegrityCheck: Record<string, unknown> | null;
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

export type DeepResearchExportRecord = {
  exportKind: string;
  label: string;
  fileName: string;
  filePath: string;
  fileHash: string;
  payloadHash: string;
  createdAt: string;
  fileSizeBytes: number | null;
};

export type DeepResearchPrimaryBusinessReport = {
  generatedAt: string | null;
  status: string;
  generatedBy: string;
  htmlExport: DeepResearchExportRecord | null;
  sourceKind: string | null;
  failureReason: string | null;
  reviewReason: string | null;
};

export type DeepResearchEvidence = DeepResearchInteraction & {
  headline: string;
  summary: string;
};

export type DeepResearchReport = {
  job: {
    id: string;
    title: string;
    userQuestion: string;
    analysisGoal: string | null;
    status: string;
    phase: string;
    failureReason: string | null;
    reviewReason: string | null;
    updatedAt: string;
    subQuestionCount: number;
    interactionCount: number;
    exportCount: number;
  };
  conclusion: DeepResearchConclusion | null;
  stages: DeepResearchStage[];
  researchPlan: DeepResearchResearchPlanView | null;
  decomposition: {
    interaction: DeepResearchInteraction | null;
    subQuestions: DeepResearchSubQuestion[];
  };
  subQuestionReports: DeepResearchSubQuestionReport[];
  finalAdjudication: {
    interaction: DeepResearchInteraction | null;
    record: unknown | null;
  };
  primaryBusinessReport: DeepResearchPrimaryBusinessReport | null;
  fullCaseFileSummary: DeepResearchFullCaseFileSummaryView;
  evidence: DeepResearchEvidence[];
  exports: DeepResearchExportRecord[];
};

export type DeepResearchLatestPayload = {
  job?: {
    id?: string;
  };
};

export type DeepResearchStartPayload = {
  jobId: string;
};

export type DeepResearchExportPayload = {
  textContent?: string;
  jsonContent?: unknown;
  base64Content?: string;
  contentType?: string;
  fileName?: string;
};

export type DeepResearchClientState = {
  history: DeepResearchHistoryJob[];
  selectedJobId: string;
  historyFilter: string;
  formOpen: boolean;
  poll: ReturnType<typeof setInterval> | null;
};
