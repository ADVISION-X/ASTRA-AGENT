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
  whyItMatters: string | null;
  decisionWeight: string | null;
  analysisFocus: string | null;
  requiredEvidence: string[];
  scope: string;
  expectedAnswerShape: string;
  priority: string | null;
  omissionRisk: string | null;
};

export type DeepResearchAnswerBlock = {
  interaction: DeepResearchInteraction | null;
  answerKind: string;
  answerText: string;
  confidence: string;
  keyPoints: string[];
  evidenceMentions: string[];
  assumptions: string[];
  limitations: string[];
  contradictionPoints: string[];
  parsedPayload: Record<string, unknown>;
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
  analysis: DeepResearchAnswerBlock | null;
  positive: DeepResearchAnswerBlock | null;
  falsification: DeepResearchAnswerBlock | null;
  conflict: DeepResearchConflict | null;
};

type DeepResearchRankedConclusion = {
  rank: number;
  conclusion: string;
  whyItMatters: string;
  strength: string;
  appliesTo: string[];
  doesNotApplyTo: string[];
  reverseCondition: string;
};

type DeepResearchConclusion = {
  directAnswer: string;
  finalVerdict: string;
  oneSentenceDecision: string;
  executiveConclusion: string;
  confidence: string;
  rankedConclusions: DeepResearchRankedConclusion[];
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
  fileSizeBytes: number | null;
};

export type DeepResearchPrimaryBusinessReport = {
  generatedAt: string | null;
  status: string;
  generatedBy: string;
  htmlExport: DeepResearchExportRecord | null;
  sourceKind: string | null;
};

export type DeepResearchBusinessDeck = {
  generatedAt: string | null;
  status: string;
  generatedBy: string;
  outlineExport: DeepResearchExportRecord | null;
  pptxExport: DeepResearchExportRecord | null;
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
    flowMode: string;
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
  finalAdjudication: {
    interaction: DeepResearchInteraction | null;
    parsedFinalReport: unknown | null;
  };
  primaryBusinessReport: DeepResearchPrimaryBusinessReport | null;
  businessDeck: DeepResearchBusinessDeck | null;
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
