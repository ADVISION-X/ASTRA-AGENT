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
  status: string;
  finalConfidence: string | null;
  updatedAt: string;
  subQuestionCount: number;
  interactionCount: number;
  exportCount: number;
};

export type DeepResearchHistoryPayload = {
  jobs: DeepResearchHistoryJob[];
};

type DeepResearchInteraction = {
  interactionId: string;
  phase: string;
  promptText: string | null;
  rawResponseText: string;
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

type DeepResearchSubQuestion = {
  id: string;
  ordinal: number;
  title: string;
  questionText: string;
  purpose: string;
  scope: string;
  expectedAnswerShape: string;
};

export type DeepResearchAnswerBlock = {
  interaction: DeepResearchInteraction | null;
  answerText: string;
  confidence: string;
  keyPoints: string[];
  evidenceMentions: string[];
  assumptions: string[];
  limitations: string[];
  contradictionPoints: string[];
};

type DeepResearchConflict = {
  positiveClaimSummary: string;
  falsificationSummary: string;
  conflictLevel: string;
  evidenceGap: string;
  needsHumanReview: boolean;
};

type DeepResearchSubQuestionReport = {
  subQuestion: DeepResearchSubQuestion;
  positive: DeepResearchAnswerBlock | null;
  falsification: DeepResearchAnswerBlock | null;
  conflict: DeepResearchConflict | null;
};

type DeepResearchConclusion = {
  executiveConclusion: string;
  confidence: string;
  positiveReasons: string[];
  strongestOpposingArguments: string[];
  evidenceGaps: string[];
  reverseConditions: string[];
  followUpSignals: string[];
  limitations: string[];
};

type DeepResearchStage = {
  id: string;
  label: string;
  anchorId: string;
  status: string;
};

export type DeepResearchExportRecord = {
  exportKind: string;
  label: string;
  fileName: string;
  filePath: string;
  fileHash: string;
  payloadHash: string;
  createdAt: string;
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
  decomposition: {
    interaction: DeepResearchInteraction | null;
    subQuestions: DeepResearchSubQuestion[];
  };
  subQuestionReports: DeepResearchSubQuestionReport[];
  finalSynthesis: {
    interaction: DeepResearchInteraction | null;
    parsedFinalReport: unknown | null;
  };
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