import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const terminalLog = (line: string): void => {
  process.stdout.write(`[GRASSEYE][PICK3][EXCHANGE] ${line}\n`);
};

import type { AiFeedInput, AiFeedResult } from "../../capabilities/ai-input-gateway/index.js";
import { parsePick3Prediction, type ParsedPick3Prediction } from "./pick3-is-blind-eval.ai-parse.js";
import {
  buildInitialCheckpoints,
  checkpointForWorkItem,
  checkpointKey,
  checkpointKeyForItem,
  isCheckpointTerminal,
  type Pick3PromptExchangeWorkItem,
} from "./pick3-is-blind-eval.ai-checkpoint.js";
import { isPick3QuotaExhaustedResult, PICK3_QUOTA_EXHAUSTED_WAIT_MS } from "./pick3-is-blind-eval.ai-quota.js";
import { randomPick3PostParseDelayMs, sleep } from "./pick3-is-blind-eval.ai-throttle.js";
import type { Pick3PlaybookPromptPackage } from "./pick3-is-blind-eval.playbook.js";
import { hashText, pick3PromptContractMetadata, publicPromptPackageId, renderPick3PredictionPrompt } from "./pick3-is-blind-eval.ai-contract.js";
import type { Pick3GatewaySender, Pick3PromptExchangeInput, Pick3PromptExchangeResult } from "./pick3-is-blind-eval.ai-types.js";
import type {
  Pick3AiInteractionRecord,
  Pick3AiProviderKind,
  Pick3ImageRecord,
  Pick3PredictionRecord,
} from "./pick3-is-blind-eval.schema.js";
export type { Pick3GatewaySender, Pick3PromptExchangeInput, Pick3PromptExchangeResult } from "./pick3-is-blind-eval.ai-types.js";

export const buildPick3AiGatewayInput = (input: {
  batchId: string;
  image: Pick3ImageRecord;
  promptPackage: Pick3PlaybookPromptPackage;
  providerKind: Pick3AiProviderKind;
}): AiFeedInput => ({
  providerKind: input.providerKind,
  taskIdentity: {
    labelKey: "pick3_analysis",
    sourceProject: "pick3-is-blind-eval",
    taskKind: "blind-chart-analysis",
    sourceTaskId: input.image.imageId,
  },
  promptPackageId: `pick3:${input.batchId}:${input.image.imageId}:${input.promptPackage.playbookVersionId}`,
  ...pick3PromptContractMetadata(input.promptPackage),
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
}): { interaction: Pick3AiInteractionRecord; parsed: ParsedPick3Prediction | null } => {
  const normalizedText = input.gatewayResult.normalizedText ?? "";
  const parsed = parsePick3Prediction({
    expectedImageId: input.image.imageId,
    expectedPromptPackageId: publicPromptPackageId(input.promptPackage),
    promptMode: input.promptPackage.promptMode,
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
      providerKind: input.gatewayInput.providerKind as Pick3AiProviderKind,
      modelId: input.gatewayResult.providerProof.modelName ?? `${input.gatewayResult.providerProof.providerKind}-manual`,
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
  parsed: ParsedPick3Prediction;
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
  tailShapes: input.parsed.tailShapes,
  zoneWeight: input.parsed.zoneWeight,
  drivingEvidence: input.parsed.drivingEvidence,
  discountedEvidence: input.parsed.discountedEvidence,
  abstainReason: input.parsed.abstainReason,
  reason: input.parsed.reason,
  predictedAt: input.interaction.createdAt,
  sealedBeforeReveal: true,
});

const RECOVERABLE_PARSE_FAILURE_REASONS = new Set<string>([
  "pick3_prediction_label_invalid",
  "pick3_provider_reported_image_missing",
]);

const PICK3_PROVIDER_REPORTED_MISSING_IMAGE_RETRY_COUNT = 3;
const PICK3_PROMPT_EXCHANGE_COMPLETION_ROUNDS = 3;

const gatewayInputForAttempt = (input: {
  gatewayInput: AiFeedInput;
  attempt: number;
}): AiFeedInput => input.attempt === 0
  ? input.gatewayInput
  : { ...input.gatewayInput, roundId: `${input.gatewayInput.roundId ?? "round"}:retry-${input.attempt}` };

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

const recoverableRetryReason = (input: {
  result: AiFeedResult;
  interaction: Pick3AiInteractionRecord;
}): string | null => {
  if (pick3CleanupFailureStatus(input.result)) return null;
  if (input.result.reviewRequiredReason?.includes("pre-image history cleanup failed")) return null;
  const rawLen = (input.result.normalizedText ?? "").trim().length;
  if (rawLen === 0) return "empty_raw_output";
  const parseFailureReason = input.interaction.parseFailureReason;
  return parseFailureReason && RECOVERABLE_PARSE_FAILURE_REASONS.has(parseFailureReason)
    ? parseFailureReason
    : null;
};

const maxAttemptsForRetryReason = (retryReason: string | null): number =>
  retryReason === "pick3_provider_reported_image_missing"
    ? 1 + PICK3_PROVIDER_REPORTED_MISSING_IMAGE_RETRY_COUNT
    : 2;

const isMissingImageRetryExhausted = (input: {
  attempt: number;
  retryReason: string | null;
}): boolean => input.retryReason === "pick3_provider_reported_image_missing"
  && input.attempt + 1 >= maxAttemptsForRetryReason(input.retryReason);

const markMissingImageSkipped = (interaction: Pick3AiInteractionRecord): Pick3AiInteractionRecord => ({
  ...interaction,
  parseStatus: "skipped_provider_reported_image_missing",
  parseFailureReason: "pick3_provider_reported_image_missing_retry_exhausted",
});

const sendWithRecoverableOutputRetry = async (input: {
  artifactDir: string;
  sender: Pick3GatewaySender;
  gatewayInput: AiFeedInput;
  image: Pick3ImageRecord;
  promptPackage: Pick3PlaybookPromptPackage;
  imageId: string;
  position: string;
  seqLabel: string;
}): Promise<{ gatewayResult: AiFeedResult; result: { interaction: Pick3AiInteractionRecord; parsed: ParsedPick3Prediction | null } }> => {
  let retryReason: string | null = null;
  let last: { gatewayResult: AiFeedResult; result: { interaction: Pick3AiInteractionRecord; parsed: ParsedPick3Prediction | null } } | null = null;
  for (let attempt = 0; attempt < maxAttemptsForRetryReason(retryReason); attempt += 1) {
    if (attempt > 0) {
      terminalLog(`[${input.seqLabel}] retry_started imageId=${input.imageId} position=${input.position} attempt=${attempt + 1} reason=${retryReason ?? "recoverable_output_contract_violation"}`);
    }
    const gatewayInput = gatewayInputForAttempt({ gatewayInput: input.gatewayInput, attempt });
    const gatewayResult = await input.sender(gatewayInput);
    const rawLen = logPick3SendResult({ ...input, result: gatewayResult, attempt });
    const result = buildInteraction({
      artifactDir: input.artifactDir,
      gatewayInput: input.gatewayInput,
      gatewayResult,
      image: input.image,
      promptPackage: input.promptPackage,
    });
    last = { gatewayResult, result };
    if (result.parsed) return last;
    if (rawLen === 0) {
      logPick3EmptyOutput({ ...input, result: gatewayResult, attempt });
    }
    retryReason = recoverableRetryReason({ result: gatewayResult, interaction: result.interaction });
    if (isMissingImageRetryExhausted({ attempt, retryReason })) {
      last = {
        gatewayResult,
        result: {
          ...result,
          interaction: markMissingImageSkipped(result.interaction),
        },
      };
      terminalLog(`[${input.seqLabel}] skipped_missing_image imageId=${input.imageId} position=${input.position} attempts=${attempt + 1} reason=pick3_provider_reported_image_missing_retry_exhausted`);
      return last;
    }
    if (!retryReason || attempt + 1 >= maxAttemptsForRetryReason(retryReason)) return last;
  }
  if (!last) throw new Error("pick3_prompt_exchange_gateway_result_missing");
  return last;
};

const buildPromptExchangeQueue = (input: Pick3PromptExchangeInput, repeatCount: number): Pick3PromptExchangeWorkItem[] => {
  const packageByImage = new Map(input.promptPackages.map((promptPackage) => [promptPackage.imageRef.imageId, promptPackage]));
  const queue: Pick3PromptExchangeWorkItem[] = [];
  for (const image of input.images) {
    const promptPackage = packageByImage.get(image.imageId);
    if (!promptPackage) throw new Error("pick3_prompt_exchange_package_missing");
    for (let repeatIndex = 1; repeatIndex <= repeatCount; repeatIndex += 1) {
      const sequence = queue.length + 1;
      const gatewayInput = buildPick3AiGatewayInput({
        batchId: image.batchId,
        image,
        promptPackage,
        providerKind: input.providerKind ?? "gpt-web-chat",
      });
      const sentGatewayInput = repeatIndex === 1 ? gatewayInput : { ...gatewayInput, roundId: `${gatewayInput.roundId ?? image.position}:repeat-${repeatIndex}` };
      queue.push({ completionRound: 0, gatewayInput: sentGatewayInput, image, promptPackage, repeatIndex, sequence });
    }
  }
  return queue;
};

const gatewayInputForCompletionRound = (item: Pick3PromptExchangeWorkItem): AiFeedInput => item.completionRound === 0
  ? item.gatewayInput
  : { ...item.gatewayInput, roundId: `${item.gatewayInput.roundId ?? item.image.position}:completion-${item.completionRound}` };

const runPromptExchangeWorkItem = async (input: {
  artifactDir: string;
  item: Pick3PromptExchangeWorkItem;
  sender: Pick3GatewaySender;
  total: number;
}): Promise<{
  gatewayInput: AiFeedInput;
  gatewayResult: AiFeedResult;
  result: { interaction: Pick3AiInteractionRecord; parsed: ParsedPick3Prediction | null };
}> => {
  const item = input.item;
  const seqLabel = `${item.sequence}/${input.total}`;
  const gatewayInput = gatewayInputForCompletionRound(item);
  terminalLog(`[${seqLabel}] send_started imageId=${item.image.imageId} position=${item.image.position} targetPhase=${item.image.targetPhase} repeatIndex=${item.repeatIndex} completionRound=${item.completionRound} promptPackageId=${gatewayInput.promptPackageId}`);
  const exchangeAttempt = await sendWithRecoverableOutputRetry({
    artifactDir: input.artifactDir,
    sender: input.sender,
    gatewayInput,
    image: item.image,
    promptPackage: item.promptPackage,
    imageId: item.image.imageId,
    position: item.image.position,
    seqLabel,
  });
  const cleanupFailureStatus = pick3CleanupFailureStatus(exchangeAttempt.gatewayResult);
  const rawLen = exchangeAttempt.result.interaction.rawResponseText.length;
  terminalLog(`[${seqLabel}] parse_result imageId=${item.image.imageId} position=${item.image.position} repeatIndex=${item.repeatIndex} completionRound=${item.completionRound} parseStatus=${exchangeAttempt.result.interaction.parseStatus} parseFailureReason=${exchangeAttempt.result.interaction.parseFailureReason ?? "none"} rawLen=${rawLen} predictionLabel=${exchangeAttempt.result.parsed?.predictionLabel ?? "none"} confidence=${exchangeAttempt.result.parsed?.confidence ?? "none"} cleanupStatus=${cleanupFailureStatus ?? "none"}`);
  return { gatewayInput, gatewayResult: exchangeAttempt.gatewayResult, result: exchangeAttempt.result };
};

const preparePromptExchangeQueue = (input: {
  exchangeInput: Pick3PromptExchangeInput;
  repeatCount: number;
}): {
  existingCheckpoints: Map<string, NonNullable<Pick3PromptExchangeInput["resumeCheckpoints"]>[number]>;
  queue: Pick3PromptExchangeWorkItem[];
  resumedCompletedCount: number;
  resumedSkippedCount: number;
} => {
  const existingCheckpoints = new Map((input.exchangeInput.resumeCheckpoints ?? []).map((checkpoint) => [
    checkpointKey({ completionRound: checkpoint.completionRound, imageId: checkpoint.imageId, repeatIndex: checkpoint.repeatIndex }),
    checkpoint,
  ]));
  let queue = buildPromptExchangeQueue(input.exchangeInput, input.repeatCount);
  if (!input.exchangeInput.taskId) return { existingCheckpoints, queue, resumedCompletedCount: 0, resumedSkippedCount: 0 };
  const missingInitial = buildInitialCheckpoints({ items: queue, taskId: input.exchangeInput.taskId })
    .filter((checkpoint) => !existingCheckpoints.has(checkpointKey({ completionRound: checkpoint.completionRound, imageId: checkpoint.imageId, repeatIndex: checkpoint.repeatIndex })));
  input.exchangeInput.onCheckpointCreate?.(missingInitial);
  for (const checkpoint of missingInitial) {
    existingCheckpoints.set(checkpointKey({ completionRound: checkpoint.completionRound, imageId: checkpoint.imageId, repeatIndex: checkpoint.repeatIndex }), checkpoint);
  }
  queue = queue.filter((item) => !isCheckpointTerminal(existingCheckpoints.get(checkpointKeyForItem(item))));
  return {
    existingCheckpoints,
    queue,
    resumedCompletedCount: [...existingCheckpoints.values()].filter((checkpoint) => checkpoint.status === "completed").length,
    resumedSkippedCount: [...existingCheckpoints.values()].filter((checkpoint) => checkpoint.status === "skipped").length,
  };
};

const buildPromptExchangeResult = (input: {
  deferredRetryCount: number;
  gatewayInputs: AiFeedInput[];
  interactions: Pick3AiInteractionRecord[];
  predictions: Pick3PredictionRecord[];
  resumedCompletedCount: number;
  resumedSkippedCount: number;
  skippedCount: number;
  total: number;
}): Pick3PromptExchangeResult => ({
  gatewayInputs: input.gatewayInputs,
  interactions: input.interactions,
  predictions: input.predictions,
  completion: {
    expectedCount: input.total,
    completedCount: input.resumedCompletedCount + input.resumedSkippedCount + input.predictions.length + input.skippedCount,
    deferredRetryCount: input.deferredRetryCount,
    skippedCount: input.resumedSkippedCount + input.skippedCount,
    unresolvedCount: input.total - input.resumedCompletedCount - input.resumedSkippedCount - input.predictions.length - input.skippedCount,
  },
});

type PromptExchangeLoopState = {
  deferredRetryCount: number;
  existingCheckpoints: Map<string, NonNullable<Pick3PromptExchangeInput["resumeCheckpoints"]>[number]>;
  gatewayInputs: AiFeedInput[];
  interactions: Pick3AiInteractionRecord[];
  maxCompletionRounds: number;
  predictions: Pick3PredictionRecord[];
  queue: Pick3PromptExchangeWorkItem[];
  skippedCount: number;
  total: number;
};

const processPromptExchangeItem = async (
  input: Pick3PromptExchangeInput,
  state: PromptExchangeLoopState,
  item: Pick3PromptExchangeWorkItem,
): Promise<void> => {
  const seqLabel = `${item.sequence}/${state.total}`;
  const checkpoint = input.taskId ? checkpointForWorkItem({ item, taskId: input.taskId }) : null;
  const { gatewayInput, gatewayResult, result } = await runPromptExchangeWorkItem({ artifactDir: input.artifactDir, item, sender: input.sender, total: state.total });
  state.gatewayInputs.push(gatewayInput);
  if (isPick3QuotaExhaustedResult(gatewayResult) && checkpoint) {
    const waitMs = input.quotaWaitMsOverride ?? PICK3_QUOTA_EXHAUSTED_WAIT_MS;
    const resumeAfter = new Date(Date.now() + waitMs).toISOString();
    input.onCheckpointPause?.({ checkpoint, resumeAfter, reason: "pick3_quota_exhausted_wait_required" });
    terminalLog(`[${seqLabel}] quota_wait_scheduled imageId=${item.image.imageId} position=${item.image.position} waitMs=${waitMs} resumeAfter=${resumeAfter}`);
    await sleep(waitMs);
    state.queue.push(item);
    return;
  }
  if (result.parsed) {
    state.interactions.push(result.interaction);
    const prediction = buildPrediction({ interaction: result.interaction, parsed: result.parsed, promptPackage: item.promptPackage });
    state.predictions.push(prediction);
    if (checkpoint) input.onWorkItemFinal?.({ checkpoint, interaction: result.interaction, prediction, status: "completed" });
    const postParseDelayMs = input.postParseDelayMsOverride ?? randomPick3PostParseDelayMs();
    terminalLog(`[${seqLabel}] post_parse_throttle_delay imageId=${item.image.imageId} position=${item.image.position} delayMs=${postParseDelayMs}`);
    await sleep(postParseDelayMs);
    return;
  }
  if (result.interaction.parseStatus === "skipped_provider_reported_image_missing") {
    state.skippedCount += 1;
    state.interactions.push(result.interaction);
    if (checkpoint) input.onWorkItemFinal?.({ checkpoint, interaction: result.interaction, prediction: null, status: "skipped" });
    return;
  }
  if (item.completionRound < state.maxCompletionRounds) {
    state.deferredRetryCount += 1;
    terminalLog(`[${seqLabel}] deferred_retry_scheduled imageId=${item.image.imageId} position=${item.image.position} repeatIndex=${item.repeatIndex} nextCompletionRound=${item.completionRound + 1} reason=${result.interaction.parseFailureReason ?? "parse_failed_raw_available"}`);
    const nextItem = { ...item, completionRound: item.completionRound + 1 };
    if (input.taskId && !state.existingCheckpoints.has(checkpointKeyForItem(nextItem))) {
      const nextCheckpoint = checkpointForWorkItem({ item: nextItem, taskId: input.taskId });
      input.onCheckpointCreate?.([nextCheckpoint]);
      state.existingCheckpoints.set(checkpointKeyForItem(nextItem), nextCheckpoint);
    }
    state.queue.push(nextItem);
    return;
  }
  state.interactions.push(result.interaction);
  if (checkpoint) input.onWorkItemFinal?.({ checkpoint, interaction: result.interaction, prediction: null, status: "unresolved" });
};

export const runPick3PromptExchange = async (input: Pick3PromptExchangeInput): Promise<Pick3PromptExchangeResult> => {
  const repeatCount = input.repeatCount ?? 1;
  const total = input.images.length * repeatCount;
  const prepared = preparePromptExchangeQueue({ exchangeInput: input, repeatCount });
  const state: PromptExchangeLoopState = {
    deferredRetryCount: 0,
    existingCheckpoints: prepared.existingCheckpoints,
    gatewayInputs: [],
    interactions: [],
    maxCompletionRounds: input.maxCompletionRounds ?? PICK3_PROMPT_EXCHANGE_COMPLETION_ROUNDS,
    predictions: [],
    queue: prepared.queue,
    skippedCount: 0,
    total,
  };
  while (state.queue.length > 0) {
    const currentQueue = state.queue;
    state.queue = [];
    for (const item of currentQueue) {
      await processPromptExchangeItem(input, state, item);
    }
  }
  return buildPromptExchangeResult({
    deferredRetryCount: state.deferredRetryCount,
    gatewayInputs: state.gatewayInputs,
    interactions: state.interactions,
    predictions: state.predictions,
    resumedCompletedCount: prepared.resumedCompletedCount,
    resumedSkippedCount: prepared.resumedSkippedCount,
    skippedCount: state.skippedCount,
    total,
  });
};
