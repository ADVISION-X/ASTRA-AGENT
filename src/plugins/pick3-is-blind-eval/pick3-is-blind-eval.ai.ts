import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { AiFeedInput, AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";
import type { Pick3PlaybookPromptPackage } from "./pick3-is-blind-eval.playbook.js";
import type {
  Pick3AiInteractionRecord,
  Pick3ImageRecord,
  Pick3PredictionLabel,
  Pick3PredictionRecord,
} from "./pick3-is-blind-eval.schema.js";

export type Pick3GatewaySender = (input: AiFeedInput) => Promise<AiFeedResult>;

type ParsedPrediction = {
  predictionLabel: Pick3PredictionLabel;
  confidence: number | null;
  abstainReason: string | null;
  reason: string | null;
};

export type Pick3PromptExchangeResult = {
  gatewayInputs: AiFeedInput[];
  interactions: Pick3AiInteractionRecord[];
  predictions: Pick3PredictionRecord[];
};

const promptContractId = "pick3-is-blind-eval-one-image-v1" as const;
const expectedOutputSchemaRef = "pick3-is-blind-eval-prediction-json-v1" as const;

const hashText = (value: string): string => createHash("sha256").update(value).digest("hex");

const renderPick3PredictionPrompt = (promptPackage: Pick3PlaybookPromptPackage): string => [
  promptPackage.systemPrompt,
  promptPackage.businessPrompt,
  "Return exactly one JSON object with these fields:",
  JSON.stringify({
    predictionLabel: "front | back | abstain",
    confidence: "number or null",
    reason: "one sentence about visible shape only",
    abstainReason: "string or null",
  }, null, 2),
  "Do not include markdown fences, file paths, target phase, date, answer digit, or action instructions.",
].join("\n\n");

export const buildPick3AiGatewayInput = (input: {
  batchId: string;
  image: Pick3ImageRecord;
  promptPackage: Pick3PlaybookPromptPackage;
}): AiFeedInput => ({
  providerKind: "gpt-web-chat",
  promptPackageId: `pick3:${input.batchId}:${input.image.imageId}:${input.promptPackage.playbookVersionId}`,
  promptContractId,
  expectedOutputSchemaRef,
  textPrompt: renderPick3PredictionPrompt(input.promptPackage),
  inputRefs: [{
    id: input.image.imageId,
    kind: "pick3-l80-blind-image",
    summary: "One opaque Pick3 L80 blind chart image.",
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
  missionId: input.batchId,
  runId: input.image.imageId,
  roundId: input.image.position,
});

const parsePrediction = (rawText: string): { parsed: ParsedPrediction | null; reason: string | null } => {
  try {
    const parsed = JSON.parse(rawText) as Partial<ParsedPrediction>;
    if (parsed.predictionLabel !== "front" && parsed.predictionLabel !== "back" && parsed.predictionLabel !== "abstain") {
      return { parsed: null, reason: "pick3_prediction_label_invalid" };
    }
    if (parsed.predictionLabel === "abstain") {
      return {
        parsed: {
          predictionLabel: "abstain",
          confidence: null,
          abstainReason: parsed.abstainReason ?? "shape_unclear",
          reason: parsed.reason ?? null,
        },
        reason: null,
      };
    }
    if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
      return { parsed: null, reason: "pick3_prediction_confidence_invalid" };
    }
    return {
      parsed: {
        predictionLabel: parsed.predictionLabel,
        confidence: parsed.confidence,
        abstainReason: null,
        reason: parsed.reason ?? null,
      },
      reason: null,
    };
  } catch {
    return { parsed: null, reason: "pick3_prediction_json_invalid" };
  }
};

const ensureRawOutputRef = (input: {
  artifactDir: string;
  imageId: string;
  normalizedText: string;
  rawOutputRef: string | null;
}): string => {
  if (input.rawOutputRef) return input.rawOutputRef;
  const dir = path.join(input.artifactDir, "ai_interaction_raw");
  mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${input.imageId}_${hashText(input.normalizedText).slice(0, 12)}.json`);
  writeFileSync(filePath, `${input.normalizedText.trim()}\n`);
  return filePath;
};

const buildInteraction = (input: {
  artifactDir: string;
  gatewayInput: AiFeedInput;
  gatewayResult: AiFeedResult;
  image: Pick3ImageRecord;
  promptPackage: Pick3PlaybookPromptPackage;
}): { interaction: Pick3AiInteractionRecord; parsed: ParsedPrediction | null } => {
  const normalizedText = input.gatewayResult.normalizedText ?? "";
  const parsed = parsePrediction(normalizedText);
  const rawResponseHash = input.gatewayResult.rawOutputHash ?? hashText(normalizedText);
  const rawOutputRef = ensureRawOutputRef({
    artifactDir: input.artifactDir,
    imageId: input.image.imageId,
    normalizedText,
    rawOutputRef: input.gatewayResult.rawOutputRef,
  });
  return {
    parsed: parsed.parsed,
    interaction: {
      interactionId: `pick3_interaction_${randomUUID()}`,
      batchId: input.image.batchId,
      imageId: input.image.imageId,
      position: input.image.position,
      promptPackageId: input.gatewayInput.promptPackageId,
      promptContractId: input.gatewayInput.promptContractId,
      playbookVersionId: input.promptPackage.playbookVersionId,
      providerKind: "gpt-web-chat",
      modelId: input.gatewayResult.providerProof.modelName ?? "gpt-web-chat-manual",
      temperature: 0,
      imageDetail: "high",
      promptHash: input.promptPackage.rawPromptHash,
      renderedPromptText: input.gatewayInput.textPrompt,
      inputRefsJson: JSON.stringify(input.gatewayInput.inputRefs),
      rawResponseText: normalizedText,
      rawResponseHash,
      rawOutputRef,
      providerProofJson: JSON.stringify(input.gatewayResult.providerProof),
      parseStatus: parsed.parsed ? "parsed" : "parse_failed_raw_available",
      parseFailureReason: parsed.reason,
      createdAt: new Date().toISOString(),
    },
  };
};

const buildPrediction = (input: {
  interaction: Pick3AiInteractionRecord;
  parsed: ParsedPrediction;
  promptPackage: Pick3PlaybookPromptPackage;
}): Pick3PredictionRecord => ({
  predictionId: `pick3_prediction_${randomUUID()}`,
  interactionId: input.interaction.interactionId,
  batchId: input.interaction.batchId,
  imageId: input.interaction.imageId,
  position: input.interaction.position,
  playbookVersionId: input.promptPackage.playbookVersionId,
  providerKind: input.interaction.providerKind,
  modelId: input.interaction.modelId,
  temperature: input.interaction.temperature,
  imageDetail: input.interaction.imageDetail,
  systemPromptVersionId: input.promptPackage.playbookVersionId,
  businessPromptVersionId: input.promptPackage.playbookVersionId,
  systemPromptHash: input.promptPackage.systemPromptHash,
  businessPromptHash: input.promptPackage.businessPromptHash,
  rawPromptHash: input.promptPackage.rawPromptHash,
  rawResponseRef: input.interaction.rawOutputRef,
  rawResponseHash: input.interaction.rawResponseHash,
  predictionLabel: input.parsed.predictionLabel,
  confidence: input.parsed.confidence,
  confidenceIsProbability: false,
  abstainReason: input.parsed.abstainReason,
  reason: input.parsed.reason,
  predictedAt: input.interaction.createdAt,
  sealedBeforeReveal: true,
});

export const runPick3PromptExchange = async (input: {
  artifactDir: string;
  images: readonly Pick3ImageRecord[];
  promptPackages: readonly Pick3PlaybookPromptPackage[];
  sender: Pick3GatewaySender;
}): Promise<Pick3PromptExchangeResult> => {
  const packageByImage = new Map(input.promptPackages.map((promptPackage) => [promptPackage.imageRef.imageId, promptPackage]));
  const gatewayInputs: AiFeedInput[] = [];
  const interactions: Pick3AiInteractionRecord[] = [];
  const predictions: Pick3PredictionRecord[] = [];
  for (const image of input.images) {
    const promptPackage = packageByImage.get(image.imageId);
    if (!promptPackage) throw new Error("pick3_prompt_exchange_package_missing");
    const gatewayInput = buildPick3AiGatewayInput({ batchId: image.batchId, image, promptPackage });
    const gatewayResult = await input.sender(gatewayInput);
    const result = buildInteraction({ artifactDir: input.artifactDir, gatewayInput, gatewayResult, image, promptPackage });
    gatewayInputs.push(gatewayInput);
    interactions.push(result.interaction);
    if (result.parsed) {
      predictions.push(buildPrediction({ interaction: result.interaction, parsed: result.parsed, promptPackage }));
    }
  }
  return { gatewayInputs, interactions, predictions };
};
