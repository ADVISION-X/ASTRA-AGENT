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

const conversationProof = (
  request: AiFeedInput,
  response: Partial<AiProviderRawResponse>,
): Pick<AiFeedProviderProof,
  "webChatUrl" | "continuationPriorTaskId" | "continuationPriorRawOutputHash"
  | "continuationRequestedUrl" | "continuationActualUrl" | "continuationVerified"
  | "webChatWorkspaceId" | "providerTabPolicy" | "providerRecoveryAttemptCount"
  | "providerRecoveryStatus" | "staleConversationCleanupStatus"
  | "staleConversationHistoryCleanupStatus" | "sourcePageUrlBeforeFeed" | "restoredSourcePage"
> => ({
  webChatUrl: response.webChatUrl ?? null,
  continuationPriorTaskId: request.providerContinuationRef?.priorTaskId ?? null,
  continuationPriorRawOutputHash: request.providerContinuationRef?.priorRawOutputHash ?? null,
  continuationRequestedUrl: request.providerContinuationRef?.providerPageUrl ?? null,
  continuationActualUrl: response.continuationActualUrl ?? null,
  continuationVerified: response.continuationVerified ?? null,
  webChatWorkspaceId: response.webChatWorkspaceId ?? null,
  providerTabPolicy: response.providerTabPolicy ?? null,
  providerRecoveryAttemptCount: response.providerRecoveryAttemptCount ?? null,
  providerRecoveryStatus: response.providerRecoveryStatus ?? null,
  staleConversationCleanupStatus: response.staleConversationCleanupStatus ?? null,
  staleConversationHistoryCleanupStatus: response.staleConversationHistoryCleanupStatus ?? null,
  sourcePageUrlBeforeFeed: response.sourcePageUrlBeforeFeed ?? null,
  restoredSourcePage: response.restoredSourcePage ?? null,
});

const uploadProof = (
  inputPackage: AiFeedInputPackage,
  response: Partial<AiProviderRawResponse>,
): Pick<AiFeedProviderProof, "uploadedFileRefs" | "uploadedFiles" | "attachmentUploadProof"> => ({
  uploadedFileRefs: response.uploadedFiles?.map((file) => file.inputRefId)
    ?? (response.transport === "api" ? inputPackage.uploadableFiles.map((file) => file.id) : []),
  uploadedFiles: response.uploadedFiles ?? [],
  ...(response.attachmentUploadProof ? { attachmentUploadProof: response.attachmentUploadProof } : {}),
});

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
  providerLeaseId: string | null;
}): AiFeedProviderProof => ({
  providerKind: input.request.providerKind,
  providerLeaseId: input.providerLeaseId,
  modelName: input.response.modelName ?? input.request.modelName,
  inputHash: input.inputPackage.inputHash,
  outputHash: input.outputHash,
  inputRefs: input.inputPackage.inputRefIds,
  ...uploadProof(input.inputPackage, input.response),
  outputRefs: [
    ...(input.rawOutputRef ? [input.rawOutputRef] : []),
    ...(input.response.outputRefs ?? []),
  ],
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: input.durationMs,
  transport: input.response.transport,
  ...conversationProof(input.request, input.response),
  transportWarnings: input.response.transportWarnings ?? [],
  retryCount: 0,
  cooldownMs: input.cooldownMs,
  estimatedInputTokens: input.response.estimatedInputTokens ?? null,
  estimatedOutputTokens: input.response.estimatedOutputTokens ?? null,
  tokenEstimateUnavailableReason: input.response.tokenEstimateUnavailableReason ?? null,
});

const buildSuccessResult = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  providerProof: AiFeedProviderProof;
  rawOutputRef: string;
  outputHash: string;
  rawResponseText: string;
  transportWarnings: string[];
}): AiFeedResult => AiFeedResultSchema.parse({
    abilityGroupId: AI_INPUT_GATEWAY_ABILITY_GROUP_ID,
    childCapabilityId: input.childCapabilityId,
    providerKind: input.request.providerKind,
    status: "success",
    rawResponseText: input.rawResponseText,
    transportWarnings: input.transportWarnings,
    // 兼容旧调用方的同字节投影；运输层不再解析、截取、修复或挑选 JSON。
    normalizedText: input.rawResponseText,
    rawOutputRef: input.rawOutputRef,
    rawOutputHash: input.outputHash,
    parseStatus: "not_requested",
    parsedJson: null,
    schemaValidationStatus: "not_applicable",
    providerProof: input.providerProof,
    failureReason: null,
    reviewRequiredReason: null,
  });

export const buildAiFeedSuccess = async (input: {
  dataDir: string;
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  inputPackage: AiFeedInputPackage;
  response: AiProviderRawResponse;
  startedAt: string;
  cooldownMs: number;
  providerLeaseId: string | null;
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
    rawResponseText: input.response.rawText,
    transportWarnings: input.response.transportWarnings ?? [],
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
  providerLeaseId?: string | null;
  response?: Partial<AiProviderRawResponse>;
}): AiFeedProviderProof => ({
  providerKind: input.request.providerKind,
  providerLeaseId: input.providerLeaseId ?? null,
  modelName: input.request.modelName,
  inputHash: input.inputPackage.inputHash,
  outputHash: null,
  inputRefs: input.inputPackage.inputRefIds,
  ...uploadProof(input.inputPackage, input.response ?? {}),
  outputRefs: [],
  startedAt: input.startedAt,
  endedAt: input.endedAt,
  durationMs: Date.parse(input.endedAt) - Date.parse(input.startedAt),
  transport: input.transport,
  ...conversationProof(input.request, input.response ?? {}),
  transportWarnings: input.response?.transportWarnings ?? [],
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
    rawResponseText: null,
    transportWarnings: input.providerProof.transportWarnings,
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
  providerLeaseId?: string | null;
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
