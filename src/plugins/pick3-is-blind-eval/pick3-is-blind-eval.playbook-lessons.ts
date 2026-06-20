import { createHash, randomUUID } from "node:crypto";

import type { AiFeedInput } from "../../capabilities/ai-input-gateway/index.js";
import type { Pick3GatewaySender } from "./pick3-is-blind-eval.ai.js";
import type {
  Pick3AiInteractionRecord,
  Pick3FailureReviewRecord,
  Pick3ImageRecord,
  Pick3PredictionRecord,
  Pick3RevealRecord,
} from "./pick3-is-blind-eval.schema.js";
import type { Pick3PlaybookLessonRecord } from "./pick3-is-blind-eval.playbook-lesson-types.js";

const hashText = (text: string): string => createHash("sha256").update(text).digest("hex");

const parseReviewJson = (rawText: string): { candidateLesson: string; rootCause: string } => {
  try {
    const parsed = JSON.parse(rawText) as { candidateLesson?: unknown; rootCause?: unknown };
    return {
      candidateLesson: typeof parsed.candidateLesson === "string" && parsed.candidateLesson.trim()
        ? parsed.candidateLesson.trim()
        : rawText.trim(),
      rootCause: typeof parsed.rootCause === "string" && parsed.rootCause.trim()
        ? parsed.rootCause.trim()
        : "ai_review_root_cause_unstructured",
    };
  } catch {
    return {
      candidateLesson: rawText.trim() || "manual_review_required",
      rootCause: "ai_review_raw_text_not_json",
    };
  }
};

const buildReviewPrompt = (input: {
  failureReview: Pick3FailureReviewRecord;
  image: Pick3ImageRecord;
  interaction: Pick3AiInteractionRecord;
  prediction: Pick3PredictionRecord;
  reveal: Pick3RevealRecord;
}): string => `You are doing post-mortem review for a historical blind time-series chart.

Hard boundary:
- Do not make a new prediction.
- Do not change the historical prediction.
- Do not propose a playbook rewrite yet.
- Analyze only why this already sealed Playbook prediction was wrong.
- The lesson must apply only to position: ${input.image.position}.

Evidence package:
- phase: ${input.image.targetPhase}
- position: ${input.image.position}
- imageId: ${input.image.imageId}
- promptPackageId: ${input.interaction.promptPackageId}
- playbookVersionId: ${input.prediction.playbookVersionId}
- historical prompt:
${input.interaction.renderedPromptText}

- historical AI raw reply:
${input.interaction.rawResponseText}

- sealed prediction: ${input.prediction.predictionLabel}
- revealed answer: ${input.reveal.answerLabel}
- failure type: ${input.failureReview.failureType}
- local failure note: ${input.failureReview.promptProblem}

Return strict JSON only:
{
  "rootCause": "why this position was wrong, grounded in the evidence",
  "candidateLesson": "one reusable Playbook lesson for this exact position family only"
}`;

const buildReviewGatewayInput = (input: {
  aiReviewPrompt: string;
  failureReview: Pick3FailureReviewRecord;
  image: Pick3ImageRecord;
}): AiFeedInput => ({
  providerKind: input.failureReview.providerKind,
  promptPackageId: `pick3-playbook-review:${input.failureReview.batchId}:${input.failureReview.imageId}:${input.failureReview.failureReviewId}`,
  promptContractId: "pick3-playbook-failure-review-v1",
  expectedOutputSchemaRef: "pick3-playbook-failure-review-json-v1",
  textPrompt: input.aiReviewPrompt,
  inputRefs: [{
    id: input.image.imageId,
    kind: "is-l80-blind-chart",
    summary: "The same historical failed one-position chart image.",
    filePath: input.image.imagePath,
    mimeType: "image/png",
    uploadStatus: "pending",
  }],
  modelName: null,
  timeoutMs: 180_000,
  maxInputChars: Number.MAX_SAFE_INTEGER,
  maxFileCount: 1,
  maxFileBytes: 20_000_000,
  requestedBy: "manual-test",
  missionId: input.failureReview.batchId,
  runId: input.failureReview.imageId,
  roundId: `${input.image.position}:playbook-review`,
});

const buildLesson = (input: {
  aiReviewPrompt: string;
  aiReviewRawText: string;
  failureReview: Pick3FailureReviewRecord;
  image: Pick3ImageRecord;
  interaction: Pick3AiInteractionRecord;
  prediction: Pick3PredictionRecord;
  reveal: Pick3RevealRecord;
  source: Pick3PlaybookLessonRecord["source"];
  taskId: string;
}): Pick3PlaybookLessonRecord => {
  const parsed = parseReviewJson(input.aiReviewRawText);
  return {
    lessonId: `pick3_lesson_${randomUUID()}`,
    batchId: input.failureReview.batchId,
    taskId: input.taskId,
    source: input.source,
    status: "candidate",
    phase: input.image.targetPhase,
    position: input.image.position,
    imageId: input.image.imageId,
    predictionId: input.prediction.predictionId,
    interactionId: input.interaction.interactionId,
    failureReviewId: input.failureReview.failureReviewId,
    promptPackageId: input.interaction.promptPackageId,
    playbookVersionId: input.prediction.playbookVersionId,
    predictedLabel: input.prediction.predictionLabel,
    answerLabel: input.reveal.answerLabel,
    aiReviewPrompt: input.aiReviewPrompt,
    aiReviewRawText: input.aiReviewRawText,
    aiReviewRawHash: hashText(input.aiReviewRawText),
    rootCause: parsed.rootCause,
    candidateLesson: parsed.candidateLesson,
    evidenceRefsJson: JSON.stringify({
      imagePath: input.image.imagePath,
      rawOutputRef: input.interaction.rawOutputRef,
      rawResponseHash: input.interaction.rawResponseHash,
      rawPromptHash: input.prediction.rawPromptHash,
    }),
    aggregateKey: `${input.image.position}:${input.failureReview.failureType}`,
    createdAt: new Date().toISOString(),
  };
};

export const reviewPick3PlaybookLessons = async (input: {
  failureReviews: readonly Pick3FailureReviewRecord[];
  images: readonly Pick3ImageRecord[];
  interactions: readonly Pick3AiInteractionRecord[];
  predictions: readonly Pick3PredictionRecord[];
  reveals: readonly Pick3RevealRecord[];
  sender: Pick3GatewaySender;
  source: Pick3PlaybookLessonRecord["source"];
  taskId: string;
}): Promise<Pick3PlaybookLessonRecord[]> => {
  const imageById = new Map(input.images.map((image) => [image.imageId, image]));
  const interactionByImage = new Map(input.interactions.map((interaction) => [interaction.imageId, interaction]));
  const predictionById = new Map(input.predictions.map((prediction) => [prediction.predictionId, prediction]));
  const revealByPrediction = new Map(input.reveals.map((reveal) => [reveal.predictionId, reveal]));
  const lessons: Pick3PlaybookLessonRecord[] = [];
  for (const failureReview of input.failureReviews) {
    const image = imageById.get(failureReview.imageId);
    const interaction = image ? interactionByImage.get(image.imageId) : undefined;
    const prediction = predictionById.get(failureReview.predictionId);
    const reveal = revealByPrediction.get(failureReview.predictionId);
    if (!image || !interaction || !prediction || !reveal) continue;
    const aiReviewPrompt = buildReviewPrompt({ failureReview, image, interaction, prediction, reveal });
    let rawText = "";
    try {
      const result = await input.sender(buildReviewGatewayInput({ aiReviewPrompt, failureReview, image }));
      rawText = result.normalizedText ?? "";
    } catch (error) {
      rawText = JSON.stringify({
        rootCause: "ai_review_failed",
        candidateLesson: `Manual ${image.position} review required: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    lessons.push(buildLesson({
      aiReviewPrompt,
      aiReviewRawText: rawText,
      failureReview,
      image,
      interaction,
      prediction,
      reveal,
      source: input.source,
      taskId: input.taskId,
    }));
  }
  return lessons;
};
