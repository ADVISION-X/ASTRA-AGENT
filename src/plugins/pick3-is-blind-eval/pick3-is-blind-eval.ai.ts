import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const terminalLog = (line: string): void => {
  process.stdout.write(`[GRASSEYE][PICK3][EXCHANGE] ${line}\n`);
};

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
  imageId: string;
  promptPackageId: string;
  predictionLabel: Pick3PredictionLabel;
  confidence: number | null;
  abstainReason: string | null;
  reason: string | null;
};

type AiVisiblePredictionLabel = "lower" | "upper" | "abstain";

export type Pick3PromptExchangeResult = {
  gatewayInputs: AiFeedInput[];
  interactions: Pick3AiInteractionRecord[];
  predictions: Pick3PredictionRecord[];
};

const promptContractId = "pick3-is-blind-eval-one-image-v1" as const;
const expectedOutputSchemaRef = "pick3-is-blind-eval-prediction-json-v1" as const;

const hashText = (value: string): string => createHash("sha256").update(value).digest("hex");

const publicPromptPackageId = (promptPackage: Pick3PlaybookPromptPackage): string =>
  `blind_series_package_${hashText(`${promptPackage.imageRef.imageId}:${promptPackage.playbookVersionId}`).slice(0, 16)}`;

const renderPick3PredictionPrompt = (promptPackage: Pick3PlaybookPromptPackage): string => [
  promptPackage.systemPrompt,
  promptPackage.businessPrompt,
  "Final output contract:",
  "Return JSON only. Do not return only `lower`, `upper`, or `abstain`. Do not wrap the JSON in markdown. Do not add commentary before or after the JSON.",
  "Identity binding:",
  JSON.stringify({
    imageId: promptPackage.imageRef.imageId,
    promptPackageId: publicPromptPackageId(promptPackage),
  }, null, 2),
  "You must copy imageId and promptPackageId exactly into the output JSON. If either value is missing or changed, the answer is invalid.",
  "Return exactly this JSON object shape, with your chosen values:",
  JSON.stringify({
    imageId: promptPackage.imageRef.imageId,
    promptPackageId: publicPromptPackageId(promptPackage),
    predictionLabel: "lower | upper | abstain",
    confidence: "number or null",
    reason: "one sentence about visible shape only",
    abstainReason: "string or null",
  }, null, 2),
  "Final reminder: output must start with `{` and end with `}`. Do not include markdown fences, file paths, target phase, date, answer digit, or action instructions.",
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
    kind: "is-l80-blind-chart",
    summary: "One opaque L80 blind time-series chart image.",
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

const parsePrediction = (input: {
  expectedImageId: string;
  expectedPromptPackageId: string;
  rawText: string;
}): { parsed: ParsedPrediction | null; reason: string | null } => {
  try {
    const parsed = JSON.parse(input.rawText) as Partial<Omit<ParsedPrediction, "predictionLabel"> & {
      predictionLabel: AiVisiblePredictionLabel;
    }>;
    if (parsed.imageId !== input.expectedImageId) {
      return { parsed: null, reason: "pick3_prediction_image_id_mismatch" };
    }
    if (parsed.promptPackageId !== input.expectedPromptPackageId) {
      return { parsed: null, reason: "pick3_prediction_prompt_package_id_mismatch" };
    }
    if (parsed.predictionLabel !== "lower" && parsed.predictionLabel !== "upper" && parsed.predictionLabel !== "abstain") {
      return { parsed: null, reason: "pick3_prediction_label_invalid" };
    }
    if (parsed.predictionLabel === "abstain") {
      return {
        parsed: {
          imageId: parsed.imageId,
          promptPackageId: parsed.promptPackageId,
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
        imageId: parsed.imageId,
        promptPackageId: parsed.promptPackageId,
        predictionLabel: parsed.predictionLabel === "lower" ? "front" : "back",
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
  const parsed = parsePrediction({
    expectedImageId: input.image.imageId,
    expectedPromptPackageId: publicPromptPackageId(input.promptPackage),
    rawText: normalizedText,
  });
  const parseFailureReason = parsed.reason
    ?? (normalizedText.trim().length === 0
      ? input.gatewayResult.reviewRequiredReason ?? input.gatewayResult.failureReason ?? null
      : null);
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
      parseFailureReason,
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

const gatewayInputForAttempt = (input: {
  gatewayInput: AiFeedInput;
  attempt: number;
}): AiFeedInput => input.attempt === 0
  ? input.gatewayInput
  : { ...input.gatewayInput, roundId: `${input.gatewayInput.roundId ?? "round"}:empty-retry-${input.attempt}` };

const logPick3SendResult = (input: {
  result: AiFeedResult;
  imageId: string;
  position: string;
  seqLabel: string;
  attempt: number;
}): number => {
  const rawLen = (input.result.normalizedText ?? "").trim().length;
  const proof = input.result.providerProof ?? {};
  const boundVerify = (proof as Record<string, unknown>).boundImageVerifyStatus ?? "not_checked";
  const boundCount = (proof as Record<string, unknown>).boundImageAttachmentCount ?? "?";
  const recoveryStatus = (proof as Record<string, unknown>).providerRecoveryStatus ?? null;
  terminalLog(`[${input.seqLabel}] send_result imageId=${input.imageId} position=${input.position} attempt=${input.attempt + 1} status=${input.result.status} rawLen=${rawLen} boundVerify=${boundVerify} boundCount=${boundCount}${recoveryStatus ? ` recoveryStatus=${recoveryStatus}` : ""}`);
  return rawLen;
};

const logPick3EmptyOutput = (input: {
  result: AiFeedResult;
  imageId: string;
  position: string;
  seqLabel: string;
  attempt: number;
}): void => {
  terminalLog(`[${input.seqLabel}] WARN empty_raw_output imageId=${input.imageId} position=${input.position} attempt=${input.attempt + 1} status=${input.result.status} reviewReason=${input.result.reviewRequiredReason ?? "none"} failureReason=${input.result.failureReason ?? "none"}`);
};

const pick3CleanupFailureStatus = (result: AiFeedResult): string | null => {
  const proof = result.providerProof as Record<string, unknown>;
  const status = proof.staleConversationHistoryCleanupStatus;
  return typeof status === "string" && /failed_[1-9]/.test(status) ? status : null;
};

const sendWithEmptyOutputRetry = async (input: {
  sender: Pick3GatewaySender;
  gatewayInput: AiFeedInput;
  imageId: string;
  position: string;
  seqLabel: string;
}): Promise<AiFeedResult> => {
  let lastResult: AiFeedResult | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      terminalLog(`[${input.seqLabel}] retry_started imageId=${input.imageId} position=${input.position} attempt=${attempt + 1} reason=empty_raw_output`);
    }
    const result = await input.sender(gatewayInputForAttempt({ gatewayInput: input.gatewayInput, attempt }));
    lastResult = result;
    const rawLen = logPick3SendResult({ ...input, result, attempt });
    if (result.status === "success" && rawLen > 0) {
      return result;
    }
    if (rawLen === 0) {
      logPick3EmptyOutput({ ...input, result, attempt });
    }
  }
  if (!lastResult) throw new Error("pick3_prompt_exchange_gateway_result_missing");
  return lastResult;
};

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
  const total = input.images.length;
  for (let idx = 0; idx < total; idx += 1) {
    const image = input.images[idx]!;
    const seqLabel = `${idx + 1}/${total}`;
    const promptPackage = packageByImage.get(image.imageId);
    if (!promptPackage) throw new Error("pick3_prompt_exchange_package_missing");
    const gatewayInput = buildPick3AiGatewayInput({ batchId: image.batchId, image, promptPackage });
    terminalLog(`[${seqLabel}] send_started imageId=${image.imageId} position=${image.position} targetPhase=${image.targetPhase} promptPackageId=${gatewayInput.promptPackageId}`);
    const gatewayResult = await sendWithEmptyOutputRetry({
      sender: input.sender,
      gatewayInput,
      imageId: image.imageId,
      position: image.position,
      seqLabel,
    });
    const result = buildInteraction({ artifactDir: input.artifactDir, gatewayInput, gatewayResult, image, promptPackage });
    const cleanupFailureStatus = pick3CleanupFailureStatus(gatewayResult);
    if (cleanupFailureStatus) {
      result.interaction.parseStatus = "parse_failed_raw_available";
      result.interaction.parseFailureReason = `pick3_provider_cleanup_failed_${cleanupFailureStatus}`;
    }
    const rawLen = result.interaction.rawResponseText.length;
    terminalLog(`[${seqLabel}] parse_result imageId=${image.imageId} position=${image.position} parseStatus=${result.interaction.parseStatus} parseFailureReason=${result.interaction.parseFailureReason ?? "none"} rawLen=${rawLen} predictionLabel=${result.parsed?.predictionLabel ?? "none"} confidence=${result.parsed?.confidence ?? "none"}`);
    gatewayInputs.push(gatewayInput);
    interactions.push(result.interaction);
    if (cleanupFailureStatus) {
      return { gatewayInputs, interactions, predictions };
    }
    if (result.parsed) {
      predictions.push(buildPrediction({ interaction: result.interaction, parsed: result.parsed, promptPackage }));
    }
  }
  return { gatewayInputs, interactions, predictions };
};
