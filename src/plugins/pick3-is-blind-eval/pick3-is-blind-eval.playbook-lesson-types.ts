import type { Pick3Position, Pick3PredictionLabel } from "./pick3-is-blind-eval.schema.js";

export type Pick3PlaybookLessonRecord = {
  lessonId: string;
  batchId: string;
  taskId: string;
  source: "auto_review" | "manual_review";
  status: "candidate" | "accepted" | "rejected" | "promoted";
  phase: string;
  position: Pick3Position;
  imageId: string;
  predictionId: string;
  interactionId: string;
  failureReviewId: string;
  promptPackageId: string;
  playbookVersionId: string;
  predictedLabel: Pick3PredictionLabel;
  answerLabel: "front" | "back";
  aiReviewPrompt: string;
  aiReviewRawText: string;
  aiReviewRawHash: string;
  rootCause: string;
  candidateLesson: string;
  evidenceRefsJson: string;
  aggregateKey: string;
  createdAt: string;
};
