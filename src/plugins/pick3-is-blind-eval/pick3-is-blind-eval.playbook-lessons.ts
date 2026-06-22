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

/**
 * The review prompt must never hand the AI the literal words "front"/"back" as evidence text —
 * predictionLabel/answerLabel are stored internally using those tokens, but if we interpolate them
 * verbatim into the evidence package, the AI is reading the forbidden word in our own prompt right
 * before we ask it not to write that word. Translating to the same upper/lower vocabulary the AI
 * already used in its own raw reply removes the leak at the source instead of relying on an
 * instruction to resist copying a word we just showed it.
 */
const toVisibleReviewLabel = (label: string): string => {
  if (label === "front") return "lower";
  if (label === "back") return "upper";
  return label;
};

/**
 * promptProblem (failure-review.ts) is freeform text built from the same internal front/back
 * tokens, e.g. "Prediction back did not match revealed shoulder-side label front." It is not a
 * single enum value like predictionLabel/answerLabel, so it needs a word-boundary text
 * replacement rather than an exact-match lookup before it can be shown to the review AI.
 */
const sanitizeReviewText = (text: string): string => text.replace(/\bfront\b/g, "lower").replace(/\bback\b/g, "upper");

const PICK3_PLAYBOOK_REVIEW_MAX_ATTEMPTS = 3;

/**
 * Strict parse only: returns null instead of falling back to a placeholder. A post-mortem reply
 * that does not parse into a real rootCause/candidateLesson is not "experience with missing
 * fields" — it is no experience at all, and must trigger a retry rather than being stored as a
 * placeholder lesson that would pollute the live-assembled experience pool with empty content.
 */
const parseStrictReviewJson = (rawText: string): { candidateLesson: string; rootCause: string } | null => {
  try {
    const parsed = JSON.parse(rawText) as { candidateLesson?: unknown; rootCause?: unknown };
    if (typeof parsed.rootCause !== "string" || !parsed.rootCause.trim()) return null;
    if (typeof parsed.candidateLesson !== "string" || !parsed.candidateLesson.trim()) return null;
    return { candidateLesson: parsed.candidateLesson.trim(), rootCause: parsed.rootCause.trim() };
  } catch {
    return null;
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
- Your rootCause and candidateLesson text will be reused in future blind prompts for other images. They must describe only visual-grammar shapes and reasoning (it is fine to say a pattern "leans upper" or "leans lower" as a tendency, or to use ordinary words like "back" or "revert" in their normal English sense). They must NEVER mention the phase number or the imageId — writing either into your answer would leak a specific answer into a future blind evaluation, which is forbidden.

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

- sealed prediction: ${toVisibleReviewLabel(input.prediction.predictionLabel)}
- revealed answer: ${toVisibleReviewLabel(input.reveal.answerLabel)}
- failure type: ${input.failureReview.failureType}
- local failure note: ${sanitizeReviewText(input.failureReview.promptProblem)}

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
  // Must contain "pick3-is-blind-eval" so the web-chat tab-reuse, workspace resolution, and
  // rate-limit dialog click-ack guards all recognize this as a Pick3 request — otherwise every
  // gate keyed on that substring (resolveWebChatWorkspaceId, isPick3GptRateLimitGuardRequest,
  // isPick3GptSubmitRequest) silently no-ops for review calls, opening a fresh tab every time and
  // leaving rate-limit dialogs during review completely unhandled.
  promptContractId: "pick3-is-blind-eval-playbook-failure-review-v1",
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
  parsed: { candidateLesson: string; rootCause: string };
  prediction: Pick3PredictionRecord;
  reveal: Pick3RevealRecord;
  source: Pick3PlaybookLessonRecord["source"];
  taskId: string;
}): Pick3PlaybookLessonRecord => {
  const parsed = input.parsed;
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
    let parsed: { candidateLesson: string; rootCause: string } | null = null;
    for (let attempt = 1; attempt <= PICK3_PLAYBOOK_REVIEW_MAX_ATTEMPTS && !parsed; attempt += 1) {
      try {
        const result = await input.sender(buildReviewGatewayInput({ aiReviewPrompt, failureReview, image }));
        rawText = result.normalizedText ?? "";
      } catch {
        rawText = "";
      }
      parsed = parseStrictReviewJson(rawText);
    }
    // Retried PICK3_PLAYBOOK_REVIEW_MAX_ATTEMPTS times with no parseable reply: discard this
    // failure entirely rather than storing a placeholder lesson that would pollute the live
    // experience pool with no real content.
    if (!parsed) continue;
    lessons.push(buildLesson({
      aiReviewPrompt,
      aiReviewRawText: rawText,
      failureReview,
      image,
      interaction,
      parsed,
      prediction,
      reveal,
      source: input.source,
      taskId: input.taskId,
    }));
  }
  return lessons;
};
