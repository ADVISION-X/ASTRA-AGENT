import type {
  Pick3ImageRecord,
  Pick3Position,
  Pick3PredictionRecord,
  Pick3RevealRecord,
  Pick3ScoringSummary,
} from "./pick3-is-blind-eval.schema.js";

import { randomUUID } from "node:crypto";

const positions: Pick3Position[] = ["hundreds", "tens", "ones"];

const emptyByPosition = (): Pick3ScoringSummary["byPosition"] => ({
  hundreds: { total: 0, hits: 0, misses: 0, abstains: 0 },
  tens: { total: 0, hits: 0, misses: 0, abstains: 0 },
  ones: { total: 0, hits: 0, misses: 0, abstains: 0 },
});

const confidenceBucket = (confidence: number | null): string => {
  if (confidence === null) return "abstain";
  if (confidence >= 0.58) return "high";
  if (confidence >= 0.54) return "medium";
  return "low";
};

export const revealPick3Predictions = (input: {
  images: readonly Pick3ImageRecord[];
  predictions: readonly Pick3PredictionRecord[];
}): Pick3RevealRecord[] => {
  const imageById = new Map(input.images.map((image) => [image.imageId, image]));
  return input.predictions.map((prediction) => {
    if (!prediction.sealedBeforeReveal) {
      throw new Error("pick3_reveal_requires_sealed_prediction");
    }
    const image = imageById.get(prediction.imageId);
    if (!image) {
      throw new Error("pick3_reveal_missing_image");
    }
    return {
      revealId: `pick3_reveal_${randomUUID()}`,
      predictionId: prediction.predictionId,
      imageId: image.imageId,
      answerDigit: image.answerDigit,
      answerLabel: image.answerLabel,
      hit: prediction.predictionLabel === image.answerLabel,
      revealedAt: new Date().toISOString(),
      officialRawHash: image.imageSha256,
    };
  });
};

export const scorePick3Predictions = (input: {
  predictions: readonly Pick3PredictionRecord[];
  reveals: readonly Pick3RevealRecord[];
}): Pick3ScoringSummary => {
  const revealByPrediction = new Map(input.reveals.map((reveal) => [reveal.predictionId, reveal]));
  const byPosition = emptyByPosition();
  const calibration = new Map<string, { total: number; hits: number }>();
  let hits = 0;
  let misses = 0;
  let abstains = 0;
  for (const prediction of input.predictions) {
    const bucket = byPosition[prediction.position];
    bucket.total += 1;
    if (prediction.predictionLabel === "abstain") {
      abstains += 1;
      bucket.abstains += 1;
      continue;
    }
    const reveal = revealByPrediction.get(prediction.predictionId);
    const hit = reveal?.hit === true;
    if (hit) {
      hits += 1;
      bucket.hits += 1;
    } else {
      misses += 1;
      bucket.misses += 1;
    }
    const key = confidenceBucket(prediction.confidence);
    const row = calibration.get(key) ?? { total: 0, hits: 0 };
    row.total += 1;
    row.hits += hit ? 1 : 0;
    calibration.set(key, row);
  }
  const total = input.predictions.length;
  return {
    total,
    hits,
    misses,
    abstains,
    coverageRate: total === 0 ? 0 : (total - abstains) / total,
    byPosition: Object.fromEntries(positions.map((position) => [position, byPosition[position]])) as Pick3ScoringSummary["byPosition"],
    randomBaseline: {
      onePositionFrontBack: 0.5,
      threePositionCombination: 0.125,
      threePositionWatchThreshold: 0.25,
      approximatePerPositionStabilityThreshold: 0.63,
    },
    calibration: [...calibration.entries()].map(([bucket, row]) => ({
      bucket,
      total: row.total,
      hits: row.hits,
      realizedHitRate: row.total === 0 ? null : row.hits / row.total,
      confidenceIsProbability: false,
    })),
  };
};
