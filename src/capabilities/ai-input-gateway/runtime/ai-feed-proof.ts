import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AiProviderRawResponse } from "../contracts/ai-provider-adapter.contract.js";
import {
  AI_INPUT_GATEWAY_ABILITY_GROUP_ID,
  AiFeedResultSchema,
  type AiFeedInput,
  type AiFeedProviderProof,
  type AiFeedResult,
  type AiInputGatewayChildCapabilityId,
} from "../schema.js";
import type { AiFeedInputPackage } from "./ai-feed-input-package.js";
import type { AiFeedParsedOutput } from "./ai-feed-output-parser.js";

const hashValue = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const outputDirectory = (dataDir: string): string =>
  path.join(dataDir, "runtime-data", "ai-input-gateway");

const writeRawOutput = async (input: {
  dataDir: string;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  rawText: string;
}): Promise<string> => {
  const directory = outputDirectory(input.dataDir);
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${input.childCapabilityId}-${randomUUID()}.txt`);
  await writeFile(filePath, input.rawText, "utf8");
  return filePath;
};

const buildProviderProof = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  response: AiProviderRawResponse;
  rawOutputRef: string | null;
  outputHash: string | null;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  cooldownMs: number;
}): AiFeedProviderProof => ({
  providerKind: input.request.providerKind,
  modelName: input.response.modelName ?? input.request.modelName,
  inputHash: input.inputPackage.inputHash,
  outputHash: input.outputHash,
  inputRefs: input.inputPackage.inputRefIds,
  outputRefs: [
    ...(input.rawOutputRef ? [input.rawOutputRef] : []),
    ...(input.response.outputRefs ?? []),
  ],
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  transport: input.response.transport,
    webChatUrl: input.response.webChatUrl,
    webChatWorkspaceId: input.response.webChatWorkspaceId ?? null,
    providerTabPolicy: input.response.providerTabPolicy ?? null,
    providerRecoveryAttemptCount: input.response.providerRecoveryAttemptCount ?? null,
    providerRecoveryStatus: input.response.providerRecoveryStatus ?? null,
    staleConversationCleanupStatus: input.response.staleConversationCleanupStatus ?? null,
    staleConversationHistoryCleanupStatus: input.response.staleConversationHistoryCleanupStatus ?? null,
    sourcePageUrlBeforeFeed: input.response.sourcePageUrlBeforeFeed,
  restoredSourcePage: input.response.restoredSourcePage,
  retryCount: 0,
  cooldownMs: input.cooldownMs,
  estimatedInputTokens: input.response.estimatedInputTokens ?? null,
  estimatedOutputTokens: input.response.estimatedOutputTokens ?? null,
  tokenEstimateUnavailableReason: input.response.tokenEstimateUnavailableReason ?? null,
});

const successStatus = (parsedOutput: AiFeedParsedOutput): "success" | "failed" =>
  parsedOutput.schemaValidationStatus === "invalid" ? "failed" : "success";

const successFailureReason = (parsedOutput: AiFeedParsedOutput): string | null =>
  parsedOutput.schemaValidationStatus === "invalid"
    ? "AI feed output failed requested parsing."
    : null;

const buildSuccessResult = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  parsedOutput: AiFeedParsedOutput;
  providerProof: AiFeedProviderProof;
  rawOutputRef: string;
  outputHash: string;
}): AiFeedResult => AiFeedResultSchema.parse({
    abilityGroupId: AI_INPUT_GATEWAY_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    providerKind: input.request.providerKind,
    status: successStatus(input.parsedOutput),
    normalizedText: input.parsedOutput.normalizedText,
    rawOutputRef: input.rawOutputRef,
    rawOutputHash: input.outputHash,
    parseStatus: input.parsedOutput.parseStatus,
    parsedJson: input.parsedOutput.parsedJson,
    schemaValidationStatus: input.parsedOutput.schemaValidationStatus,
    providerProof: input.providerProof,
    failureReason: successFailureReason(input.parsedOutput),
    reviewRequiredReason: null,
  });

export const buildAiFeedSuccess = async (input: {
  dataDir: string;
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  response: AiProviderRawResponse;
  parsedOutput: AiFeedParsedOutput;
  startedAt: string;
  cooldownMs: number;
}): Promise<AiFeedResult> => {
  const rawOutputRef = await writeRawOutput({
    dataDir: input.dataDir,
    childCapabilityId: input.childCapabilityId,
    rawText: input.response.rawText,
  });
  const outputHash = hashValue(input.response.rawText);
  const endedAt = new Date().toISOString();
  return buildSuccessResult({
    ...input,
    rawOutputRef,
    outputHash,
    providerProof: buildProviderProof({
      ...input,
      rawOutputRef,
      outputHash,
      endedAt,
      durationMs: Date.parse(endedAt) - Date.parse(input.startedAt),
    }),
  });
};

const buildFailureProviderProof = (input: {
  request: AiFeedInput;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  endedAt: string;
  transport: "api" | "web-chat";
  cooldownMs?: number;
  response?: Partial<AiProviderRawResponse>;
}): AiFeedProviderProof => ({
  providerKind: input.request.providerKind,
  modelName: input.request.modelName,
  inputHash: input.inputPackage.inputHash,
  outputHash: null,
  inputRefs: input.inputPackage.inputRefIds,
  outputRefs: [],
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: Date.parse(input.endedAt) - Date.parse(input.startedAt),
  transport: input.transport,
    webChatUrl: input.response?.webChatUrl ?? null,
    webChatWorkspaceId: input.response?.webChatWorkspaceId ?? null,
    providerTabPolicy: input.response?.providerTabPolicy ?? null,
    providerRecoveryAttemptCount: input.response?.providerRecoveryAttemptCount ?? null,
    providerRecoveryStatus: input.response?.providerRecoveryStatus ?? null,
    staleConversationCleanupStatus: input.response?.staleConversationCleanupStatus ?? null,
    staleConversationHistoryCleanupStatus: input.response?.staleConversationHistoryCleanupStatus ?? null,
  sourcePageUrlBeforeFeed: input.response?.sourcePageUrlBeforeFeed ?? null,
  restoredSourcePage: input.response?.restoredSourcePage ?? null,
  retryCount: 0,
  cooldownMs: input.cooldownMs ?? 0,
  estimatedInputTokens: null,
  estimatedOutputTokens: null,
  tokenEstimateUnavailableReason: "feed did not reach provider output.",
});

const buildFailureResult = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  status: "failed" | "review_required";
  reason: string;
  providerProof: AiFeedProviderProof;
}): AiFeedResult => AiFeedResultSchema.parse({
    abilityGroupId: AI_INPUT_GATEWAY_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    providerKind: input.request.providerKind,
    status: input.status,
    normalizedText: null,
    rawOutputRef: null,
    rawOutputHash: null,
    parseStatus: input.request.expectedOutputSchemaRef ? "json_invalid" : "not_requested",
    parsedJson: null,
    schemaValidationStatus: input.request.expectedOutputSchemaRef ? "invalid" : "not_applicable",
    providerProof: input.providerProof,
    failureReason: input.status === "failed" ? input.reason : null,
    reviewRequiredReason: input.status === "review_required" ? input.reason : null,
  });

export const buildAiFeedFailure = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  startedAt: string;
  transport: "api" | "web-chat";
  status: "failed" | "review_required";
  reason: string;
  cooldownMs?: number;
  response?: Partial<AiProviderRawResponse>;
}): AiFeedResult => {
  const endedAt = new Date().toISOString();
  return buildFailureResult({
    ...input,
    providerProof: buildFailureProviderProof({
      ...input,
      endedAt,
    }),
  });
};
