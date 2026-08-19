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
import { assertProviderExecutionProfileIntegrity } from "../provider-execution-profile.js";
import type { AiFeedInputPackage } from "./ai-feed-input-package.js";

const hashValue = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

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

type ConversationProof = Pick<AiFeedProviderProof,
  "conversationMode" | "conversationScopeRef" | "freshConversationProof"
  | "sameConversationProof" | "forkedFromCheckpointProof"
  | "webChatUrl" | "continuationPriorTaskId" | "continuationPriorRawOutputHash"
  | "continuationRequestedUrl" | "continuationActualUrl" | "continuationVerified"
  | "webChatWorkspaceId" | "providerTabPolicy" | "providerRecoveryAttemptCount"
  | "providerRecoveryStatus" | "staleConversationCleanupStatus"
  | "staleConversationHistoryCleanupStatus" | "sourcePageUrlBeforeFeed" | "restoredSourcePage"
>;

const freshConversationProof = (
  mode: ConversationProof["conversationMode"],
  response: Partial<AiProviderRawResponse>,
): AiFeedProviderProof["freshConversationProof"] => {
  const submission = response.submissionProof ?? null;
  if (mode !== "fresh" || !submission?.executionId || !submission.turnMarker
    || submission.previousUserMessageCount !== 0
    || submission.previousAssistantCount !== 0) return null;
  return {
    preSubmitUserTurnCount: 0,
    preSubmitAssistantTurnCount: 0,
    continuationParent: null,
    forkParent: null,
    firstTurnMarker: submission.turnMarker,
    createdConversationUrl: submission.canonicalConversationUrl
      ?? submission.transientConversationUrl,
    createdByExecutionId: submission.executionId,
    verifiedAt: submission.submittedAt,
  };
};

const sameConversationProof = (
  request: AiFeedInput,
  response: Partial<AiProviderRawResponse>,
): AiFeedProviderProof["sameConversationProof"] => {
  const submission = response.submissionProof;
  const parent = request.providerContinuationRef;
  if (!parent || !submission?.turnMarker || response.continuationVerified !== true) return null;
  return {
    parentConversationUrl: parent.providerPageUrl,
    parentRawOutputHash: parent.priorRawOutputHash,
    actualConversationUrl: submission.canonicalConversationUrl
      ?? submission.transientConversationUrl,
    priorTurnMarker: parent.priorTurnMarker ?? null,
    newTurnMarker: submission.turnMarker,
    continuationVerifiedAt: submission.submittedAt,
  };
};

const forkedConversationProof = (
  response: Partial<AiProviderRawResponse>,
): AiFeedProviderProof["forkedFromCheckpointProof"] => {
  const fork = response.forkActionProof;
  const submission = response.submissionProof;
  const actualUrl = submission?.canonicalConversationUrl
    ?? submission?.transientConversationUrl;
  if (!fork || !submission?.turnMarker || actualUrl !== fork.childConversationUrl) return null;
  return {
    parentConversationUrl: fork.parentConversationUrl,
    parentCheckpointTurnMarker: fork.parentCheckpointTurnMarker,
    parentCheckpointResponseHash: fork.parentCheckpointResponseHash,
    forkActionEvidenceRef: fork.forkActionEvidenceRef,
    forkActionEvidenceHash: fork.forkActionEvidenceHash,
    childConversationUrl: fork.childConversationUrl,
    childInitialHistoryFingerprint: fork.childInitialHistoryFingerprint,
    childFirstTurnMarker: submission.turnMarker,
    verifiedAt: submission.submittedAt,
  };
};

const conversationLineage = (
  request: AiFeedInput,
  response: Partial<AiProviderRawResponse>,
): Pick<ConversationProof,
  "conversationScopeRef" | "webChatUrl" | "continuationPriorTaskId"
  | "continuationPriorRawOutputHash" | "continuationRequestedUrl"
  | "continuationActualUrl" | "continuationVerified"
> => ({
  conversationScopeRef: request.conversationScopeRef ?? null,
  webChatUrl: response.webChatUrl ?? null,
  continuationPriorTaskId: request.providerContinuationRef?.priorTaskId ?? null,
  continuationPriorRawOutputHash: request.providerContinuationRef?.priorRawOutputHash ?? null,
  continuationRequestedUrl: request.providerContinuationRef?.providerPageUrl ?? null,
  continuationActualUrl: response.continuationActualUrl ?? null,
  continuationVerified: response.continuationVerified ?? null,
});

const conversationRecovery = (
  response: Partial<AiProviderRawResponse>,
): Pick<ConversationProof,
  "webChatWorkspaceId" | "providerTabPolicy" | "providerRecoveryAttemptCount"
  | "providerRecoveryStatus" | "staleConversationCleanupStatus"
  | "staleConversationHistoryCleanupStatus" | "sourcePageUrlBeforeFeed" | "restoredSourcePage"
> => ({
  webChatWorkspaceId: response.webChatWorkspaceId ?? null,
  providerTabPolicy: response.providerTabPolicy ?? null,
  providerRecoveryAttemptCount: response.providerRecoveryAttemptCount ?? null,
  providerRecoveryStatus: response.providerRecoveryStatus ?? null,
  staleConversationCleanupStatus: response.staleConversationCleanupStatus ?? null,
  staleConversationHistoryCleanupStatus: response.staleConversationHistoryCleanupStatus ?? null,
  sourcePageUrlBeforeFeed: response.sourcePageUrlBeforeFeed ?? null,
  restoredSourcePage: response.restoredSourcePage ?? null,
});

const conversationProof = (
  request: AiFeedInput,
  response: Partial<AiProviderRawResponse>,
): ConversationProof => {
  const mode = request.providerForkRef
    ? "forked_from_checkpoint"
    : request.providerContinuationRef ? "same_conversation" : "fresh";
  return {
    conversationMode: mode,
    ...conversationLineage(request, response),
    freshConversationProof: freshConversationProof(mode, response),
    sameConversationProof: mode === "same_conversation"
      ? sameConversationProof(request, response) : null,
    forkedFromCheckpointProof: mode === "forked_from_checkpoint"
      ? forkedConversationProof(response) : null,
    ...conversationRecovery(response),
  };
};

const uploadProof = (
  inputPackage: AiFeedInputPackage,
  response: Partial<AiProviderRawResponse>,
): Pick<AiFeedProviderProof, "uploadedFileRefs" | "uploadedFiles" | "attachmentUploadProof"> => ({
  uploadedFileRefs: response.uploadedFiles?.map((file) => file.inputRefId)
    ?? (response.transport === "api" ? inputPackage.uploadableFiles.map((file) => file.id) : []),
  uploadedFiles: response.uploadedFiles ?? [],
  attachmentUploadProof: response.attachmentUploadProof,
});

const assertRequestedProviderExecutionProfile = (input: {
  request: AiFeedInput;
  response: AiProviderRawResponse;
}): void => {
  const requested = input.request.providerExecutionProfile;
  if (!requested) return;
  assertProviderExecutionProfileIntegrity(requested);
  const observed = input.response.providerExecutionProfileProof;
  if (!observed) {
    throw new Error("AI_INPUT_GATEWAY_PROVIDER_EXECUTION_PROFILE_PROOF_MISSING");
  }
  if (
    observed.profileRef !== requested.profileRef
    || observed.profileHash !== requested.profileHash
    || observed.provider !== requested.provider
    || observed.transport !== requested.transport
    || observed.modelDisplayName !== requested.modelDisplayName
    || observed.modelFamily.toLowerCase() !== requested.modelFamily.toLowerCase()
    || observed.reasoningTier !== requested.reasoningTier
  ) {
    throw new Error("AI_INPUT_GATEWAY_PROVIDER_EXECUTION_PROFILE_PROOF_MISMATCH");
  }
};

const assertConversationTitleProof = (input: {
  request: AiFeedInput;
  response: AiProviderRawResponse;
}): void => {
  if (!input.request.providerExecutionProfile || input.request.providerKind !== "gpt-web-chat") return;
  // A same-conversation request may legitimately refer to a legacy parent that
  // predates the title protocol. All newly created/forked conversations and all
  // continuations carrying an inherited title proof must finalize the title.
  const requiresTitle = !input.request.providerContinuationRef
    || Boolean(input.request.providerContinuationRef.priorConversationTitleProof);
  if (!requiresTitle) return;
  const title = input.response.conversationTitleProof;
  if (!title || title.proofStatus !== "verified") {
    throw new Error("AI_INPUT_GATEWAY_CONVERSATION_TITLE_PROOF_MISSING");
  }
  const actual = input.response.submissionProof?.canonicalConversationUrl
    ?? input.response.webChatUrl;
  if (!actual || new URL(actual).pathname !== new URL(title.canonicalConversationUrl).pathname) {
    throw new Error("AI_INPUT_GATEWAY_CONVERSATION_TITLE_PROOF_URL_MISMATCH");
  }
};

const assertGovernedResponseProof = (input: {
  request: AiFeedInput;
  response: AiProviderRawResponse;
}): void => {
  if (input.response.transport !== "web-chat") return;
  assertRequestedProviderExecutionProfile(input);
  assertConversationTitleProof(input);
};

const buildProviderProof = (input: {
  request: AiFeedInput;
  inputPackage: AiFeedInputPackage;
  response: AiProviderRawResponse;
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
  modelIdentityProof: input.response.modelIdentityProof ?? null,
  providerExecutionProfileProof: input.response.providerExecutionProfileProof ?? null,
  conversationTitleProof: input.response.conversationTitleProof ?? null,
  ...(input.response.providerTranscriptJsonl
    ? {
        providerTranscriptJsonl: input.response.providerTranscriptJsonl,
        providerTranscriptHash: input.response.providerTranscriptHash
          ?? hashValue(input.response.providerTranscriptJsonl),
      }
    : { providerTranscriptJsonl: null, providerTranscriptHash: null }),
  inputHash: input.inputPackage.inputHash,
  outputHash: input.outputHash,
  inputRefs: input.inputPackage.inputRefIds,
  ...uploadProof(input.inputPackage, input.response),
  outputRefs: input.response.outputRefs ?? [],
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

const assertWebChatConversationProof = (input: {
  request: AiFeedInput;
  response: AiProviderRawResponse;
  providerProof: AiFeedProviderProof;
}): void => {
  if (input.response.transport !== "web-chat") return;
  const expectedMode = input.request.providerForkRef
    ? "forked_from_checkpoint"
    : input.request.providerContinuationRef
      ? "same_conversation"
      : "fresh";
  const exactProof = expectedMode === "forked_from_checkpoint"
    ? input.providerProof.forkedFromCheckpointProof
    : expectedMode === "same_conversation"
      ? input.providerProof.sameConversationProof
      : input.providerProof.freshConversationProof;
  if (input.providerProof.conversationMode !== expectedMode || !exactProof) {
    throw new Error(`AI_INPUT_GATEWAY_CONVERSATION_TOPOLOGY_PROOF_MISSING:${expectedMode}`);
  }
};

const buildSuccessResult = (input: {
  request: AiFeedInput;
  childCapabilityId: AiInputGatewayChildCapabilityId;
  providerProof: AiFeedProviderProof;
  rawOutputRef: string;
  outputHash: string;
  rawResponseText: string;
  transportWarnings: string[];
  outputKind: "text" | "generated_image";
  outputArtifacts: AiProviderRawResponse["outputArtifacts"];
}): AiFeedResult => AiFeedResultSchema.parse({
  abilityGroupId: AI_INPUT_GATEWAY_ABILITY_GROUP_ID,
  childCapabilityId: input.childCapabilityId,
  providerKind: input.request.providerKind,
  status: "success",
  outputKind: input.outputKind,
  outputArtifacts: input.outputArtifacts ?? [],
  rawResponseText: input.rawResponseText,
  transportWarnings: input.transportWarnings,
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
  const artifacts = input.response.outputArtifacts ?? [];
  if (
    (input.request.expectedOutputKind === "generated_image" && artifacts.length !== 1)
    || (input.request.expectedOutputKind === "text" && artifacts.length !== 0)
  ) throw new Error("AI_INPUT_GATEWAY_OUTPUT_KIND_MISMATCH");
  assertGovernedResponseProof({ request: input.request, response: input.response });
  const rawOutputRef = await writeRawOutput({
    dataDir: input.dataDir,
    childCapabilityId: input.childCapabilityId,
    rawText: input.response.rawText,
  });
  const outputHash = hashValue(input.response.rawText);
  const endedAt = new Date().toISOString();
  const providerProof = buildProviderProof({
    request: input.request,
    inputPackage: input.inputPackage,
    response: {
      ...input.response,
      outputRefs: [rawOutputRef, ...(input.response.outputRefs ?? [])],
    },
    outputHash,
    startedAt: input.startedAt,
    endedAt,
    durationMs: Date.parse(endedAt) - Date.parse(input.startedAt),
    cooldownMs: input.cooldownMs,
    providerLeaseId: input.providerLeaseId,
  });
  assertWebChatConversationProof({ request: input.request, response: input.response, providerProof });
  return buildSuccessResult({
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    providerProof,
    rawOutputRef,
    outputHash,
    rawResponseText: input.response.rawText,
    transportWarnings: input.response.transportWarnings ?? [],
    outputKind: input.request.expectedOutputKind,
    outputArtifacts: input.response.outputArtifacts ?? [],
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
  modelName: input.response?.modelName ?? input.request.modelName,
  modelIdentityProof: input.response?.modelIdentityProof ?? null,
  providerExecutionProfileProof: input.response?.providerExecutionProfileProof ?? null,
  conversationTitleProof: input.response?.conversationTitleProof ?? null,
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
  outputKind: input.request.expectedOutputKind,
  outputArtifacts: [],
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
    request: input.request,
    childCapabilityId: input.childCapabilityId,
    status: input.status,
    reason: input.reason,
    providerProof: buildFailureProviderProof({ ...input, endedAt }),
  });
};
