import { randomUUID } from "node:crypto";

import type {
  Pick3FailureReviewRecord,
  Pick3ImageRecord,
  Pick3PredictionRecord,
  Pick3RevealRecord,
} from "./pick3-is-blind-eval.schema.js";

const classifyFailure = (prediction: Pick3PredictionRecord): string => {
  const text = `${prediction.reason ?? ""} ${prediction.abstainReason ?? ""}`.toLowerCase();
  if (text.includes("rebound") || text.includes("反弹")) return "low_rebound_missed";
  if (text.includes("top") || text.includes("尖顶")) return "high_exhaustion_missed";
  if (text.includes("shoulder") || text.includes("肩膀")) return "shoulder_false_break";
  if (text.includes("momentum") || text.includes("惯性")) return "momentum_overfollow";
  return "unknown";
};

const buildRepairInstruction = (failureType: string): string => {
  if (failureType === "low_rebound_missed") return "Tighten low rebound handling: require tail confirmation before following downward pressure.";
  if (failureType === "high_exhaustion_missed") return "Tighten high exhaustion handling: treat sharp top plus unfinished drop as reversal risk.";
  if (failureType === "shoulder_false_break") return "Mark shoulder-line breaks without tail follow-through as fragile and prefer abstain.";
  if (failureType === "momentum_overfollow") return "Reduce momentum continuation weight when the tail has already bent against the prior move.";
  return "Prefer abstain when visual grammar cannot explain the tail state clearly.";
};

export const reviewPick3Failures = (input: {
  images: readonly Pick3ImageRecord[];
  predictions: readonly Pick3PredictionRecord[];
  reveals: readonly Pick3RevealRecord[];
}): Pick3FailureReviewRecord[] => {
  const imageById = new Map(input.images.map((image) => [image.imageId, image]));
  const predictionById = new Map(input.predictions.map((prediction) => [prediction.predictionId, prediction]));
  return input.reveals.filter((reveal) => !reveal.hit).map((reveal) => {
    const prediction = predictionById.get(reveal.predictionId);
    const image = imageById.get(reveal.imageId);
    if (!prediction || !image) throw new Error("pick3_failure_review_missing_prediction_or_image");
    const failureType = classifyFailure(prediction);
    return {
      failureReviewId: `pick3_failure_${randomUUID()}`,
      batchId: prediction.batchId,
      imageId: image.imageId,
      position: image.position,
      predictionId: prediction.predictionId,
      answerLabel: reveal.answerLabel,
      answerDigit: reveal.answerDigit,
      providerKind: prediction.providerKind,
      modelId: prediction.modelId,
      temperature: prediction.temperature,
      imageDetail: prediction.imageDetail,
      systemPromptVersionId: prediction.systemPromptVersionId,
      businessPromptVersionId: prediction.businessPromptVersionId,
      rawPromptHash: prediction.rawPromptHash,
      rawResponseRef: prediction.rawResponseRef,
      failureType,
      promptProblem: `Prediction ${prediction.predictionLabel} did not match revealed shoulder-side label ${reveal.answerLabel}.`,
      repairInstruction: buildRepairInstruction(failureType),
      createdAt: new Date().toISOString(),
    };
  });
};
