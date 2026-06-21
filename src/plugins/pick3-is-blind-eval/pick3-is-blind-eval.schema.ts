import { z } from "zod";

export const PICK3_JOB_ID = "pick3-is-blind-eval" as const;
export const PICK3_OFFICIAL_SOURCE = "theuaelottery" as const;
export const PICK3_LOTTERY_TYPE = 72 as const;
export const PICK3_WINDOW_SIZE = 80 as const;

export const Pick3PositionSchema = z.enum(["hundreds", "tens", "ones"]);
export type Pick3Position = z.infer<typeof Pick3PositionSchema>;

export const Pick3ModeSchema = z.enum([
  "sync_only",
  "generate_batch",
  "full_pipeline",
  "next_prediction_stability",
]);
export type Pick3Mode = z.infer<typeof Pick3ModeSchema>;

export const Pick3AiProviderKindSchema = z.enum(["gpt-web-chat", "gemini-web-chat"]);
export type Pick3AiProviderKind = z.infer<typeof Pick3AiProviderKindSchema>;

export const Pick3PromptModeSchema = z.enum(["playbook_v1", "free_analysis_strict_reasoning"]);

export const Pick3InputSchema = z.object({
  mode: Pick3ModeSchema.default("generate_batch"),
  providerKind: Pick3AiProviderKindSchema.default("gpt-web-chat"),
  promptMode: Pick3PromptModeSchema.default("playbook_v1"),
  source: z.literal(PICK3_OFFICIAL_SOURCE).default(PICK3_OFFICIAL_SOURCE),
  lotteryType: z.literal(PICK3_LOTTERY_TYPE).default(PICK3_LOTTERY_TYPE),
  windowSize: z.literal(PICK3_WINDOW_SIZE).default(PICK3_WINDOW_SIZE),
  positions: z.array(Pick3PositionSchema).default(["hundreds", "tens", "ones"]),
  batchSize: z.number().int().positive().max(30).default(3),
  lastTargetPhase: z.string().trim().min(1).optional(),
  explicitTargetPhases: z.array(z.string().min(1)).optional(),
  artifactRoot: z.string().min(1).optional(),
  dryRun: z.boolean().default(true),
});
export type Pick3Input = z.infer<typeof Pick3InputSchema>;

export type Pick3Draw = {
  source: typeof PICK3_OFFICIAL_SOURCE;
  lotteryType: typeof PICK3_LOTTERY_TYPE;
  phase: string;
  expectedPrizeTime: string;
  expectedPrizeTimestamp: string;
  resultText: string;
  hundreds: number;
  tens: number;
  ones: number;
  totalWinningBetCount: number | null;
  resultDetailJson: string;
  rawJson: string;
  rawHash: string;
};

export type Pick3ImageRecord = {
  imageId: string;
  batchId: string;
  position: Pick3Position;
  targetPhase: string;
  targetExpectedPrizeTime: string;
  visibleStartPhase: string;
  visibleEndPhase: string;
  imagePath: string;
  imageSha256: string;
  answerDigit: number | null;
  answerLabel: "front" | "back" | null;
};

export type Pick3PredictionLabel = "front" | "back" | "abstain";

export type Pick3AiInteractionRecord = {
  interactionId: string;
  batchId: string;
  imageId: string;
  position: Pick3Position;
  promptPackageId: string;
  promptContractId: string;
  playbookVersionId: string;
  providerKind: Pick3AiProviderKind;
  modelId: string;
  temperature: number;
  imageDetail: string;
  promptHash: string;
  renderedPromptText: string;
  inputRefsJson: string;
  rawResponseText: string;
  rawResponseHash: string;
  rawOutputRef: string;
  providerProofJson: string;
  parseStatus: "parsed" | "parse_failed_raw_available" | "skipped_provider_reported_image_missing";
  parseFailureReason: string | null;
  createdAt: string;
};

export type Pick3PredictionRecord = {
  predictionId: string;
  interactionId: string;
  batchId: string;
  imageId: string;
  position: Pick3Position;
  playbookVersionId: string;
  providerKind: Pick3AiProviderKind;
  modelId: string;
  temperature: number;
  imageDetail: string;
  systemPromptVersionId: string;
  businessPromptVersionId: string;
  systemPromptHash: string;
  businessPromptHash: string;
  rawPromptHash: string;
  rawResponseRef: string;
  rawResponseHash: string;
  predictionLabel: Pick3PredictionLabel;
  confidence: number | null;
  confidenceIsProbability: false;
  tailShapes: string[] | null;
  zoneWeight: "lower_weighted" | "upper_weighted" | "balanced" | null;
  drivingEvidence: string | null;
  discountedEvidence: string | null;
  abstainReason: string | null;
  reason: string | null;
  predictedAt: string;
  sealedBeforeReveal: true;
};

export type Pick3RevealRecord = {
  revealId: string;
  predictionId: string;
  imageId: string;
  answerDigit: number;
  answerLabel: "front" | "back";
  hit: boolean;
  revealedAt: string;
  officialRawHash: string;
};

export type Pick3FailureReviewRecord = {
  failureReviewId: string;
  batchId: string;
  imageId: string;
  position: Pick3Position;
  predictionId: string;
  answerLabel: "front" | "back";
  answerDigit: number;
  providerKind: Pick3AiProviderKind;
  modelId: string;
  temperature: number;
  imageDetail: string;
  systemPromptVersionId: string;
  businessPromptVersionId: string;
  rawPromptHash: string;
  rawResponseRef: string;
  failureType: string;
  promptProblem: string;
  repairInstruction: string;
  createdAt: string;
};

export type Pick3SyncSummary = {
  runId: string;
  status: "success" | "partial_success" | "failed" | "review_required";
  officialStartTime: string;
  officialEndTime: string;
  rowsSeen: number;
  rowsInserted: number;
  rowsUpdated: number;
  newestPhase: string | null;
  oldestPhase: string | null;
  reason: string | null;
  officialApiResponseHash: string | null;
};

export type Pick3BatchSummary = {
  batchId: string;
  artifactDir: string;
  imageCount: number;
  sealedAnswersHash: string;
  images: Pick3ImageRecord[];
};

export type Pick3ScoringSummary = {
  total: number;
  hits: number;
  misses: number;
  abstains: number;
  coverageRate: number;
  byPosition: Record<Pick3Position, { total: number; hits: number; misses: number; abstains: number }>;
  randomBaseline: {
    onePositionFrontBack: 0.5;
    threePositionCombination: 0.125;
    threePositionWatchThreshold: 0.25;
    approximatePerPositionStabilityThreshold: 0.63;
  };
  calibration: Array<{
    bucket: string;
    total: number;
    hits: number;
    realizedHitRate: number | null;
    confidenceIsProbability: false;
  }>;
};

type Pick3StabilityResult = {
  position: Pick3Position;
  imageId: string;
  repeatIndex: number;
  interactionId: string;
  predictionId: string | null;
  predictionLabel: Pick3PredictionLabel | null;
  visiblePredictionLabel: "lower" | "upper" | "abstain" | null;
  confidence: number | null;
  parseStatus: Pick3AiInteractionRecord["parseStatus"];
  parseFailureReason: string | null;
  rawOutputRef: string;
};

type Pick3StabilitySummary = {
  deferredRetryCount?: number;
  repeatCount: number;
  results: Pick3StabilityResult[];
  unresolvedCount?: number;
};

export type Pick3TaskRecord = {
  taskId: string;
  mode: Pick3Mode;
  promptMode: z.infer<typeof Pick3PromptModeSchema>;
  status: "success" | "partial_success" | "failed" | "review_required";
  reachedStep: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  sync: Pick3SyncSummary;
  batch: Pick3BatchSummary | null;
  scoring: Pick3ScoringSummary | null;
  stability: Pick3StabilitySummary | null;
};
