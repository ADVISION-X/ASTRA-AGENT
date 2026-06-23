import type { AiFeedInput } from "../../capabilities/ai-input-gateway/index.js";
import type { Pick3PlaybookPromptPackage } from "./pick3-is-blind-eval.playbook.js";
import type { Pick3PromptExchangeCheckpoint } from "./pick3-is-blind-eval.checkpoint-types.js";
import type { Pick3ImageRecord } from "./pick3-is-blind-eval.schema.js";

export type Pick3PromptExchangeWorkItem = {
  completionRound: number;
  gatewayInput: AiFeedInput;
  image: Pick3ImageRecord;
  promptPackage: Pick3PlaybookPromptPackage;
  repeatIndex: number;
  sequence: number;
};

export const checkpointKey = (input: { completionRound: number; imageId: string; repeatIndex: number }): string =>
  `${input.imageId}:${input.repeatIndex}:${input.completionRound}`;

export const checkpointKeyForItem = (item: Pick3PromptExchangeWorkItem): string =>
  checkpointKey({ completionRound: item.completionRound, imageId: item.image.imageId, repeatIndex: item.repeatIndex });

export const buildInitialCheckpoints = (input: {
  items: readonly Pick3PromptExchangeWorkItem[];
  taskId: string;
}): Pick3PromptExchangeCheckpoint[] => input.items.map((item) => ({
  taskId: input.taskId,
  batchId: item.image.batchId,
  imageId: item.image.imageId,
  promptPackageId: item.gatewayInput.promptPackageId,
  repeatIndex: item.repeatIndex,
  sequence: item.sequence,
  completionRound: item.completionRound,
  status: "pending",
  interactionId: null,
  predictionId: null,
  pauseReason: null,
  resumeAfter: null,
  updatedAt: new Date().toISOString(),
}));

export const isCheckpointTerminal = (checkpoint: Pick3PromptExchangeCheckpoint | undefined): boolean =>
  checkpoint?.status === "completed" || checkpoint?.status === "skipped";

export const checkpointForWorkItem = (input: {
  item: Pick3PromptExchangeWorkItem;
  taskId: string;
}): Pick3PromptExchangeCheckpoint => ({
  taskId: input.taskId,
  batchId: input.item.image.batchId,
  imageId: input.item.image.imageId,
  promptPackageId: input.item.gatewayInput.promptPackageId,
  repeatIndex: input.item.repeatIndex,
  sequence: input.item.sequence,
  completionRound: input.item.completionRound,
  status: "pending",
  interactionId: null,
  predictionId: null,
  pauseReason: null,
  resumeAfter: null,
  updatedAt: new Date().toISOString(),
});
