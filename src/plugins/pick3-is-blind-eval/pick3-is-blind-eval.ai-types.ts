import type { AiFeedInput, AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";
import type { Pick3PromptExchangeCheckpoint } from "./pick3-is-blind-eval.checkpoint-types.js";
import type {
  Pick3AiInteractionRecord,
  Pick3AiProviderKind,
  Pick3ImageRecord,
  Pick3PredictionRecord,
} from "./pick3-is-blind-eval.schema.js";
import type { Pick3PlaybookPromptPackage } from "./pick3-is-blind-eval.playbook.js";

export type Pick3GatewaySender = (input: AiFeedInput) => Promise<AiFeedResult>;

export type Pick3PromptExchangeResult = {
  gatewayInputs: AiFeedInput[];
  interactions: Pick3AiInteractionRecord[];
  predictions: Pick3PredictionRecord[];
  completion: {
    expectedCount: number;
    completedCount: number;
    deferredRetryCount: number;
    skippedCount: number;
    unresolvedCount: number;
  };
};

export type Pick3PromptExchangeInput = {
  artifactDir: string;
  images: readonly Pick3ImageRecord[];
  maxCompletionRounds?: number;
  postParseDelayMsOverride?: number;
  promptPackages: readonly Pick3PlaybookPromptPackage[];
  providerKind?: Pick3AiProviderKind;
  repeatCount?: number;
  resumeCheckpoints?: readonly Pick3PromptExchangeCheckpoint[];
  sender: Pick3GatewaySender;
  taskId?: string;
  onCheckpointCreate?: (checkpoints: readonly Pick3PromptExchangeCheckpoint[]) => void;
  onCheckpointPause?: (input: {
    checkpoint: Pick3PromptExchangeCheckpoint;
    resumeAfter: string;
    reason: string;
  }) => void;
  onWorkItemFinal?: (input: {
    checkpoint: Pick3PromptExchangeCheckpoint;
    interaction: Pick3AiInteractionRecord;
    prediction: Pick3PredictionRecord | null;
    status: "completed" | "skipped" | "unresolved";
  }) => void;
  quotaWaitMsOverride?: number;
};
