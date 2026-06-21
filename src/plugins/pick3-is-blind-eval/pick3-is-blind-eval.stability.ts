import { writeFileSync } from "node:fs";
import path from "node:path";

import { runPick3PromptExchange, type Pick3GatewaySender } from "./pick3-is-blind-eval.ai.js";
import type { BuiltPick3Batch } from "./pick3-is-blind-eval.flow-types.js";
import { buildPick3PlaybookPromptPackage, loadBuiltInPick3Playbooks } from "./pick3-is-blind-eval.playbook.js";
import type { Pick3Storage } from "./pick3-is-blind-eval.storage.js";
import type {
  Pick3AiInteractionRecord,
  Pick3Input,
  Pick3Position,
  Pick3PredictionLabel,
} from "./pick3-is-blind-eval.schema.js";

export type Pick3StabilityResult = {
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

export type Pick3StabilitySummary = {
  deferredRetryCount: number;
  repeatCount: number;
  results: Pick3StabilityResult[];
  skippedCount: number;
  unresolvedCount: number;
};

const buildSelectedPromptPackages = (
  batch: BuiltPick3Batch,
  promptMode: Pick3Input["promptMode"],
  storage: Pick3Storage,
): BuiltPick3Batch["promptPackages"] => {
  const playbooks = loadBuiltInPick3Playbooks(promptMode);
  const playbookByPosition = new Map(playbooks.map((playbook) => [playbook.position, playbook]));
  const experienceLessonsByPosition = new Map<Pick3Position, ReturnType<Pick3Storage["listPlaybookLessonsByPosition"]>>(
    (["hundreds", "tens", "ones"] as const).map((position) => [position, storage.listPlaybookLessonsByPosition(position)]),
  );
  return batch.images.map((image) => {
    const playbook = playbookByPosition.get(image.position);
    if (!playbook) throw new Error(`pick3_selected_playbook_missing_${image.position}`);
    return buildPick3PlaybookPromptPackage(playbook, image, promptMode, experienceLessonsByPosition.get(image.position) ?? []);
  });
};

const visiblePredictionLabel = (
  label: Pick3StabilityResult["predictionLabel"],
): Pick3StabilityResult["visiblePredictionLabel"] => {
  if (label === "front") return "lower";
  if (label === "back") return "upper";
  return label;
};

const assertCompleteStabilityExchange = (input: {
  expectedCount: number;
  results: Pick3StabilityResult[];
  unresolvedCount: number;
}): void => {
  const firstFailure = input.results.find((result) => result.parseStatus === "parse_failed_raw_available");
  if (firstFailure || input.unresolvedCount > 0 || input.results.length !== input.expectedCount) {
    throw new Error(`pick3_next_stability_exchange_incomplete_${input.results.length}_of_${input.expectedCount}_${firstFailure?.parseFailureReason ?? "result_count_mismatch"}`);
  }
};

export const runPick3NextPredictionStability = async (input: {
  batch: BuiltPick3Batch;
  batchInput: Pick3Input;
  sender: Pick3GatewaySender;
  storage: Pick3Storage;
}): Promise<Pick3StabilitySummary> => {
  const promptPackages = buildSelectedPromptPackages(input.batch, input.batchInput.promptMode, input.storage);
  const exchange = await runPick3PromptExchange({
    artifactDir: input.batch.artifactDir,
    images: input.batch.images,
    promptPackages,
    providerKind: input.batchInput.providerKind,
    repeatCount: input.batchInput.batchSize,
    sender: input.sender,
  });
  input.storage.insertAiInteractions(exchange.interactions);
  input.storage.insertPredictions(exchange.predictions);
  const predictionByInteraction = new Map(exchange.predictions.map((prediction) => [prediction.interactionId, prediction]));
  const repeatCounterByImage = new Map<string, number>();
  const results = exchange.interactions.map((interaction): Pick3StabilityResult => {
    const repeatIndex = (repeatCounterByImage.get(interaction.imageId) ?? 0) + 1;
    repeatCounterByImage.set(interaction.imageId, repeatIndex);
    const prediction = predictionByInteraction.get(interaction.interactionId) ?? null;
    return {
      position: interaction.position,
      imageId: interaction.imageId,
      repeatIndex,
      interactionId: interaction.interactionId,
      predictionId: prediction?.predictionId ?? null,
      predictionLabel: prediction?.predictionLabel ?? null,
      visiblePredictionLabel: visiblePredictionLabel(prediction?.predictionLabel ?? null),
      confidence: prediction?.confidence ?? null,
      parseStatus: interaction.parseStatus,
      parseFailureReason: interaction.parseFailureReason,
      rawOutputRef: interaction.rawOutputRef,
    };
  });
  const summary = {
    deferredRetryCount: exchange.completion.deferredRetryCount,
    repeatCount: input.batchInput.batchSize,
    results,
    skippedCount: exchange.completion.skippedCount,
    unresolvedCount: exchange.completion.unresolvedCount,
  };
  writeFileSync(path.join(input.batch.artifactDir, "stability_results.json"), `${JSON.stringify(summary, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "ai_gateway_inputs.json"), `${JSON.stringify(exchange.gatewayInputs, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "ai_interactions.json"), `${JSON.stringify(exchange.interactions, null, 2)}\n`);
  writeFileSync(path.join(input.batch.artifactDir, "ai_predictions.json"), `${JSON.stringify(exchange.predictions, null, 2)}\n`);
  assertCompleteStabilityExchange({
    expectedCount: input.batch.images.length * input.batchInput.batchSize,
    results,
    unresolvedCount: exchange.completion.unresolvedCount,
  });
  return summary;
};
