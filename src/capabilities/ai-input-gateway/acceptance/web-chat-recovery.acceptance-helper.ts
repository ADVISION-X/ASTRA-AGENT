import assert from "node:assert/strict";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
  type AiProviderAdapter,
} from "../index.js";
import { classifyWebChatFailure } from "../failure-classification.js";
import { readWebChatExecution } from "../runtime/web-chat-execution-state.js";
import { readWebChatResponseCheckpoint } from "../runtime/web-chat-response-checkpoint.js";
const answerText = "durable answer captured before post-processing";

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
      executionId: "checkpoint-recovery-execution",
      turnMarker: "checkpoint-recovery-turn-marker",
      transientConversationUrl: "https://chatgpt.com/c/checkpoint-recovery",
      canonicalConversationUrl: "https://chatgpt.com/c/checkpoint-recovery",
      userTurnId: "checkpoint-user-turn",
      previousAssistantCount: 0,
      previousUserMessageCount: 0,
      submittedAt: now,
    },
  };
};

const captureThenInterruptPostProcessing = async (input: {
  dataDir: string;
  executionId: string;
  request: AiFeedInput;
  submissionCount: { value: number };
}): Promise<void> => {
  const { attachmentUploadProof, submission } = checkpointFixture();
  let releasePostProcessing!: () => void;
  const postProcessingGate = new Promise<void>((resolve) => {
    releasePostProcessing = resolve;
  });
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
      await postProcessingGate;
      throw new Error("review_required: simulated interruption during artifact cleanup");
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir: input.dataDir,
    adapters: { "gpt-web-chat": interruptedAdapter },
  });
  const execution = gateway.execute(input.request, {
    executionId: input.executionId,
  });
  const interrupted = await Promise.race([
    execution,
    new Promise<never>((_resolve, reject) =>
      setTimeout(
        () => reject(new Error(
          "checkpoint publication waited for blocked post-processing",
        )),
        750,
      )),
  ]);
  assert.equal(
    interrupted.status,
    "success",
    "a durable response checkpoint must complete the feed even when post-processing is interrupted",
  );
  assert.equal(interrupted.normalizedText, answerText);
  const checkpointed = await readWebChatExecution(input.dataDir, input.executionId);
  assert.equal(checkpointed?.status, "response_captured");
  assert.ok(checkpointed?.responseCheckpoint);
  assert.equal("chatTitleRename" in checkpointed!, false);
  assert.equal(
    await readWebChatResponseCheckpoint(checkpointed.responseCheckpoint!),
    answerText,
  );
  releasePostProcessing();
  await new Promise<void>((resolve) => setTimeout(resolve, 50));
};

const resumeFromCheckpoint = async (input: {
  dataDir: string;
  executionId: string;
  request: AiFeedInput;
}): Promise<void> => {
  const resumedAdapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed() {
      throw new Error(
        "checkpoint recovery must finish before browser or provider access",
      );
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
  assert.match(
    resumed.providerProof.providerLeaseId ?? "",
    /^web-chat-(?:capacity|checkpoint-recovery):/u,
    "checkpoint publication must retain or recover a durable provider lease proof",
  );
  assert.equal(
    resumed.providerProof.outputRefs.some((outputRef) =>
      outputRef.includes("web-chat-response-checkpoints")),
    true,
    "published proof must retain the durable response checkpoint reference",
  );
};

export const assertResponseCheckpointRecovery = async (
  dataDir: string,
  request: AiFeedInput,
): Promise<void> => {
  const executionId = "checkpoint-recovery-execution";
  const submissionCount = { value: 0 };
  await captureThenInterruptPostProcessing({
    dataDir,
    executionId,
    request,
    submissionCount,
  });
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
  assert.match(
    (await readWebChatExecution(dataDir, executionId))?.providerLeaseId ?? "",
    /^web-chat-(?:capacity|checkpoint-recovery):/u,
    "the execution ledger must persist the provider lease across restart",
  );
};

const assertPermanentFailure = async (
  dataDir: string,
  request: AiFeedInput,
): Promise<void> => {
  const executionId = "traceable-permanent-failure-execution";
  const permanentAdapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed() {
      throw new Error("invalid immutable prompt package identity");
    },
  };
  const permanentGateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: { "gpt-web-chat": permanentAdapter },
  });
  await permanentGateway.execute({
    ...request,
    textPrompt: `${request.textPrompt}\npermanent-failure-fixture`,
    roundId: `${request.roundId}:permanent`,
  }, { executionId });
  assert.equal(
    (await readWebChatExecution(dataDir, executionId))?.status,
    "failed",
    "a permanent input identity failure must not enter an automatic retry loop",
  );
};

export const assertFailureLedger = async (
  dataDir: string,
  request: AiFeedInput,
): Promise<void> => {
  const duplicatePhysicalTab = new Error(
    "review_required: more than one physical provider tab is open.",
  );
  assert.equal(
    classifyWebChatFailure(duplicatePhysicalTab, false),
    "review_required",
    "ambiguous physical provider identity before submission needs an operator",
  );
  assert.equal(
    classifyWebChatFailure(duplicatePhysicalTab, true),
    "recovery_pending",
    "physical monitor interference after durable submission must retain the same provider turn",
  );
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
  assert.equal(record?.status, "recovery_pending");
  assert.deepEqual(record?.failures.map((failure) => ({
    classification: failure.classification,
    recoverable: failure.recoverable,
    reason: failure.reason,
  })), [{
    classification: "recovery_pending",
    recoverable: true,
    reason: "fixture provider composer unavailable",
  }], "temporary provider unavailability must preserve a recoverable bounded failure ledger");

  const { attachmentUploadProof, submission } = checkpointFixture();
  const returnedAdapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed() {
      return {
        rawText: "provider returned after temporary unavailability",
        modelName: "acceptance-fixture",
        runtimeName: "acceptance-fixture",
        transport: "web-chat",
        webChatUrl: submission.canonicalConversationUrl,
        submissionProof: submission,
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
        attachmentUploadProof,
      };
    },
  };
  const returnedGateway = createAiInputGatewayAbilityGroup({
    dataDir,
    adapters: { "gpt-web-chat": returnedAdapter },
  });
  const recovered = await returnedGateway.execute(request, { executionId });
  assert.equal(recovered.status, "success");
  assert.equal(
    (await readWebChatExecution(dataDir, executionId))?.status,
    "response_captured",
    "the same pre-submit execution must pass the duplicate-input guard when the provider returns",
  );
  await assertPermanentFailure(dataDir, request);
};
