import { createHash } from "node:crypto";

import type { AiProviderRawResponse } from "../contracts/ai-provider-adapter.contract.js";
import type { AiFeedInput } from "../schema.js";
import {
  readWebChatExecution,
  updateWebChatExecution,
} from "../runtime/web-chat-execution-state.js";
import { readWebChatResponseCheckpoint } from "../runtime/web-chat-response-checkpoint.js";
import { titleProofFromState } from "../runtime/web-chat-conversation-title-policy.js";
import { buildWebChatRawResponse } from "./web-chat-shared-support.js";

const runtimeNameFor = (providerKind: AiFeedInput["providerKind"]): string =>
  providerKind === "gpt-web-chat" ? "gpt-web-chat" : "gemini-web-chat";

export type RecoveredCheckpointedWebChatResponse = {
  response: AiProviderRawResponse;
  providerLeaseId: string;
};

const checkpointRecoveryLeaseId = (input: {
  executionId: string;
  attemptId: string;
  inputHash: string;
  outputHash: string;
}): string => `web-chat-checkpoint-recovery:${createHash("sha256")
  .update([input.executionId, input.attemptId, input.inputHash, input.outputHash].join("\u0000"))
  .digest("hex")}`;

export const recoverCheckpointedWebChatProviderLease = async (input: {
  dataDir: string;
  executionId: string;
  expectedInputHash: string;
  expectedOutputHash: string;
}): Promise<string | null> => {
  let record = await readWebChatExecution(input.dataDir, input.executionId);
  if (!record?.responseCheckpoint) return null;
  if (record.inputHash !== input.expectedInputHash
    || record.responseCheckpoint.rawOutputHash !== input.expectedOutputHash
    || (record.responseHash !== null && record.responseHash !== input.expectedOutputHash)) {
    throw new Error(
      "review_required: checkpoint publication lease identity does not match the completed provider result.",
    );
  }
  await readWebChatResponseCheckpoint(record.responseCheckpoint);
  const providerLeaseId = record.providerLeaseId ?? checkpointRecoveryLeaseId({
    executionId: record.executionId,
    attemptId: record.attemptId,
    inputHash: record.inputHash,
    outputHash: record.responseCheckpoint.rawOutputHash,
  });
  if (!record.providerLeaseId) {
    record = await updateWebChatExecution({
      dataDir: input.dataDir,
      record,
      patch: { providerLeaseId },
    });
  }
  return providerLeaseId;
};

const legacyModelIdentityProof = (
  response: AiProviderRawResponse,
): AiProviderRawResponse["modelIdentityProof"] => {
  const proof = response.providerExecutionProfileProof;
  return proof ? {
    proofStatus: "verified",
    modelFamily: proof.modelFamily,
    modelDisplayName: proof.modelDisplayName,
    modelIdentityStatus: "verified",
    reasoningEffort: proof.legacyReasoningEffort,
    observedAt: proof.observedAt,
    sourceKind: proof.sourceKind,
    evidenceRef: proof.evidenceRef,
    evidenceHash: proof.evidenceHash,
  } : null;
};

export const recoverCheckpointedWebChatResponse = async (input: {
  request: AiFeedInput;
  dataDir: string;
  executionId: string;
  expectedInputHash: string;
}): Promise<RecoveredCheckpointedWebChatResponse | null> => {
  const record = await readWebChatExecution(input.dataDir, input.executionId);
  if (!record?.responseCheckpoint) return null;
  if (record.inputHash !== input.expectedInputHash) {
    throw new Error(
      "review_required: response checkpoint input identity does not match the requested feed.",
    );
  }
  if (!record.submission || !record.attachmentUploadProof) {
    throw new Error(
      "review_required: response checkpoint is missing its durable submission or attachment proof.",
    );
  }
  const productionGpt = record.providerKind === "gpt-web-chat"
    && Boolean(record.providerExecutionProfileBinding);
  if (productionGpt) {
    if (!record.providerExecutionProfileProof) return null;
    if (record.conversationTitle?.status !== "verified") return null;
  }
  const answerText = await readWebChatResponseCheckpoint(record.responseCheckpoint);
  const providerLeaseId = await recoverCheckpointedWebChatProviderLease({
    dataDir: input.dataDir,
    executionId: input.executionId,
    expectedInputHash: input.expectedInputHash,
    expectedOutputHash: record.responseCheckpoint.rawOutputHash,
  });
  if (!providerLeaseId) {
    throw new Error(
      "review_required: response checkpoint disappeared before publication lease recovery.",
    );
  }
  const conversationUrl = record.responseCheckpoint.pageUrl
    || record.submission.canonicalConversationUrl
    || record.submission.transientConversationUrl;
  const provisional = buildWebChatRawResponse({
    request: input.request,
    runtimeName: runtimeNameFor(record.providerKind),
    providerUrl: conversationUrl,
    sourcePageUrlBeforeFeed: null,
    extracted: {
      status: "success",
      message: "Recovered completed provider answer from its durable response checkpoint after required session finalization.",
      answerText,
      pageUrl: conversationUrl,
    },
    answerText,
    providerExecutionProfileProof: record.providerExecutionProfileProof,
    conversationTitleProof: titleProofFromState(record.conversationTitle),
    uploadedFiles: record.uploadedFiles,
    attachmentUploadProof: record.attachmentUploadProof,
    outputRefs: [record.responseCheckpoint.rawOutputRef],
    managedParallelExecution: true,
    forkActionProof: record.forkActionProof,
    submissionProof: record.submission,
  });
  provisional.modelIdentityProof = legacyModelIdentityProof(provisional);
  return { providerLeaseId, response: provisional };
};

export const markCheckpointedWebChatResponsePublished = async (input: {
  dataDir: string;
  executionId: string;
  responseHash: string;
}): Promise<void> => {
  const record = await readWebChatExecution(input.dataDir, input.executionId);
  if (!record?.responseCheckpoint) {
    throw new Error(
      "review_required: published checkpoint response no longer has a durable checkpoint.",
    );
  }
  const titleVerified = !record.conversationTitle
    || record.conversationTitle.status === "verified";
  if (!titleVerified) {
    throw new Error("WEB_CHAT_TITLE_FINALIZATION_NOT_READY:checkpoint cannot publish before title proof");
  }
  await updateWebChatExecution({
    dataDir: input.dataDir,
    record,
    patch: {
      status: record.conversationTitle ? "finalized" : "response_captured",
      responseHash: input.responseHash,
    },
  });
};
