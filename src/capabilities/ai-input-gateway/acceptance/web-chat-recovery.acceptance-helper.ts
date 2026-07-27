import assert from "node:assert/strict";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
  type AiProviderAdapter,
} from "../index.js";
import { readWebChatExecution } from "../runtime/web-chat-execution-state.js";
import { readWebChatResponseCheckpoint } from "../runtime/web-chat-response-checkpoint.js";

const answerText = "durable answer captured before title rename";

const checkpointFixture = () => {
  const now = new Date().toISOString();
  return {
    attachmentUploadProof: {
      childCapabilityId: "attach-approved-web-chat-files-once" as const,
      uploadAttemptId: "checkpoint-recovery-upload",
      transportKind: "skipped" as const,
      expectedFileCount: 0,
      detectedFileCount: 0,
      stagingManifestHash: null,
      files: [],
      startedAt: now,
      endedAt: now,
      status: "skipped" as const,
      failureReason: null,
      reviewRequiredReason: null,
    },
    submission: {
      transientConversationUrl: "https://chatgpt.com/c/checkpoint-recovery",
      canonicalConversationUrl: "https://chatgpt.com/c/checkpoint-recovery",
      systemChatTitle: null,
      observedAutoChatTitle: "fixture",
      chatTitleVerifiedAt: null,
      userTurnId: "checkpoint-user-turn",
      previousAssistantCount: 0,
      previousUserMessageCount: 0,
      submittedAt: now,
    },
  };
};

const interruptAfterCheckpoint = async (input: {
  dataDir: string;
  executionId: string;
  request: AiFeedInput;
  submissionCount: { value: number };
}): Promise<void> => {
  const { attachmentUploadProof, submission } = checkpointFixture();
  const interruptedAdapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed(_request, context) {
      const execution = context.webChatExecution!;
      input.submissionCount.value += 1;
      await execution.onSubmissionObserved({
        submission,
        uploadedFiles: [],
        attachmentUploadProof,
      });
      await execution.onSubmitted({
        submission,
        uploadedFiles: [],
        attachmentUploadProof,
      });
      await execution.onResponseCaptured({
        answerText,
        pageUrl: submission.canonicalConversationUrl,
      });
      throw new Error("review_required: simulated interruption during title rename");
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir: input.dataDir,
    adapters: { "gpt-web-chat": interruptedAdapter },
  });
  const interrupted = await gateway.execute(input.request, {
    executionId: input.executionId,
  });
  assert.equal(interrupted.status, "review_required");
  const checkpointed = await readWebChatExecution(input.dataDir, input.executionId);
  assert.equal(checkpointed?.status, "recovery_pending");
  assert.ok(checkpointed?.responseCheckpoint);
  assert.equal(
    await readWebChatResponseCheckpoint(checkpointed.responseCheckpoint!),
    answerText,
  );
};

const resumeFromCheckpoint = async (input: {
  dataDir: string;
  executionId: string;
  request: AiFeedInput;
}): Promise<void> => {
  const { attachmentUploadProof, submission } = checkpointFixture();
  const resumedAdapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed(_request, context) {
      assert.ok(context.webChatExecution?.resumeSubmission);
      assert.ok(context.webChatExecution?.resumeResponseCheckpoint);
      return {
        rawText: await readWebChatResponseCheckpoint(
          context.webChatExecution.resumeResponseCheckpoint!,
        ),
        modelName: "acceptance-fixture",
        runtimeName: "acceptance-fixture",
        transport: "web-chat",
        webChatUrl: submission.canonicalConversationUrl,
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
        attachmentUploadProof,
      };
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir: input.dataDir,
    adapters: { "gpt-web-chat": resumedAdapter },
  });
  const resumed = await gateway.execute(input.request, {
    executionId: input.executionId,
  });
  assert.equal(
    resumed.status,
    "success",
    resumed.failureReason ?? resumed.reviewRequiredReason ?? "checkpoint resume failed",
  );
  assert.equal(resumed.normalizedText, answerText);
};

export const assertResponseCheckpointRecovery = async (
  dataDir: string,
  request: AiFeedInput,
): Promise<void> => {
  const executionId = "checkpoint-recovery-execution";
  const submissionCount = { value: 0 };
  await interruptAfterCheckpoint({ dataDir, executionId, request, submissionCount });
  await resumeFromCheckpoint({ dataDir, executionId, request });
  assert.equal(
    submissionCount.value,
    1,
    "recovery must not submit the same provider turn twice",
  );
  assert.equal(
    (await readWebChatExecution(dataDir, executionId))?.status,
    "response_captured",
  );
};

export const assertFailureLedger = async (
  dataDir: string,
  request: AiFeedInput,
): Promise<void> => {
  const executionId = "traceable-failure-execution";
  const adapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed() {
      throw new Error("fixture provider composer unavailable");
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: { "gpt-web-chat": adapter },
  });
  const result = await gateway.execute(request, { executionId });
  assert.equal(result.status, "failed");
  const record = await readWebChatExecution(dataDir, executionId);
  assert.equal(record?.status, "failed");
  assert.deepEqual(record?.failures.map((failure) => ({
    classification: failure.classification,
    recoverable: failure.recoverable,
    reason: failure.reason,
  })), [{
    classification: "failed",
    recoverable: false,
    reason: "fixture provider composer unavailable",
  }], "a failed task must preserve its exact bounded failure ledger");
};
