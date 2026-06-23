export type Pick3TaskProgress = {
  completedCount: number;
  currentImageId: string | null;
  currentSequence: number | null;
  expectedCount: number;
  pendingCount: number;
  resumeAfter: string | null;
  skippedCount: number;
  unresolvedCount: number;
};

export type Pick3CheckpointStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "paused_rate_limited"
  | "unresolved";

export type Pick3PromptExchangeCheckpoint = {
  taskId: string;
  batchId: string;
  imageId: string;
  promptPackageId: string;
  repeatIndex: number;
  sequence: number;
  completionRound: number;
  status: Pick3CheckpointStatus;
  interactionId: string | null;
  predictionId: string | null;
  pauseReason: string | null;
  resumeAfter: string | null;
  updatedAt: string;
};
