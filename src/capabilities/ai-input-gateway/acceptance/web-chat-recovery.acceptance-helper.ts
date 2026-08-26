import { createHash } from "node:crypto";
import assert from "node:assert/strict";

import {
  createAiInputGatewayAbilityGroup,
  type AiFeedInput,
} from "../index.js";
import { classifyWebChatFailure } from "../failure-classification.js";
import type {
  AiProviderAdapter,
  ProviderExecutionProfileProof,
  WebChatConversationTitleProof,
  WebChatConversationTitleState,
  WebChatExecutionContext,
} from "../contracts/ai-provider-adapter.contract.js";
import { readWebChatExecution } from "../runtime/web-chat-execution-state.js";
import { readWebChatResponseCheckpoint } from "../runtime/web-chat-response-checkpoint.js";

const answerText = "durable answer captured before post-processing";
const hash = (value: string): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;

const checkpointFixture = () => {
  const now = new Date().toISOString();
  return {
    attachmentUploadProof: {
      childCapabilityId: "attach-approved-web-chat-files-once" as const,
      uploadAttemptId: "checkpoint-recovery-upload",
      transportKind: "skipped" as const,
      expectedFileCount: 0,
      detectedFileCount: 0,
      mutationSent: false,
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
      userTurnId: "conversation-turn-1",
      previousAssistantCount: 0,
      previousUserMessageCount: 0,
      submittedAt: now,
    },
  };
};

const fixtureProfileProof = (
  request: AiFeedInput,
): ProviderExecutionProfileProof => {
  const profile = request.providerExecutionProfile!;
  const observedAt = new Date().toISOString();
  const evidenceHash = hash(JSON.stringify({ profile, observedAt }));
  return {
    proofStatus: "verified",
    profileRef: profile.profileRef,
    profileHash: profile.profileHash,
    provider: profile.provider,
    transport: profile.transport,
    modelDisplayName: profile.modelDisplayName,
    modelFamily: profile.modelFamily,
    reasoningTier: profile.reasoningTier,
    reasoningUiLabel: profile.reasoningTier,
    observedAt,
    sourceKind: "provider_ui_observation",
    noOp: false,
    evidenceRef: `fixture-profile:${evidenceHash.slice(7)}`,
    evidenceHash,
  };
};

const fixtureTitleProof = (input: {
  state: WebChatConversationTitleState;
  canonicalConversationUrl: string;
}): WebChatConversationTitleProof => {
  const verifiedAt = new Date().toISOString();
  const evidenceHash = hash(JSON.stringify({
    expectedTitle: input.state.expectedTitle,
    canonicalConversationUrl: input.canonicalConversationUrl,
    verifiedAt,
  }));
  return {
    proofStatus: "verified",
    owner: input.state.owner,
    policyVersion: input.state.policyVersion,
    sourceMappingVersion: input.state.sourceMappingVersion,
    operatorTimeZone: input.state.operatorTimeZone,
    expectedTitle: input.state.expectedTitle,
    expectedTitleHash: input.state.expectedTitleHash,
    shortTrace: input.state.shortTrace,
    previousObservedTitle: "provider automatic title",
    observedTitle: input.state.expectedTitle,
    canonicalConversationUrl: input.canonicalConversationUrl,
    verifiedAt,
    evidenceRef: `fixture-title:${evidenceHash.slice(7)}`,
    evidenceHash,
  };
};

const assertPendingTitleCheckpoint = async (input: {
  dataDir: string;
  executionId: string;
  execution: Promise<Awaited<ReturnType<ReturnType<typeof createAiInputGatewayAbilityGroup>["execute"]>>>;
}): Promise<void> => {
  const checkpoint = await readWebChatExecution(input.dataDir, input.executionId);
  assert.equal(
    checkpoint?.status,
    "title_finalization_pending",
    "answer bytes must be durable before the required title finalization completes",
  );
  assert.ok(checkpoint?.responseCheckpoint);
  const premature = await Promise.race([
    input.execution.then(() => "published" as const),
    new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 250)),
  ]);
  assert.equal(
    premature,
    "blocked",
    "a production checkpoint must not publish final success before title proof",
  );
};

const assertFinalizedCheckpoint = async (input: {
  dataDir: string;
  executionId: string;
  execution: Promise<Awaited<ReturnType<ReturnType<typeof createAiInputGatewayAbilityGroup>["execute"]>>>;
}): Promise<void> => {
  const interrupted = await input.execution;
  assert.equal(interrupted.status, "success");
  assert.equal(interrupted.normalizedText, answerText);
  assert.ok(interrupted.providerProof.providerExecutionProfileProof);
  assert.ok(interrupted.providerProof.conversationTitleProof);
  const checkpointed = await readWebChatExecution(input.dataDir, input.executionId);
  assert.equal(checkpointed?.status, "finalized");
  assert.ok(checkpointed?.responseCheckpoint);
  assert.equal(
    await readWebChatResponseCheckpoint(checkpointed.responseCheckpoint!),
    answerText,
  );
};

const captureThenInterruptPostProcessing = async (input: {
  dataDir: string;
  executionId: string;
  request: AiFeedInput;
  submissionCount: { value: number };
}): Promise<void> => {
  const { attachmentUploadProof, submission } = checkpointFixture();
  let announceCheckpoint!: () => void;
  const checkpointReached = new Promise<void>((resolve) => { announceCheckpoint = resolve; });
  let allowTitle!: () => void;
  const titleGate = new Promise<void>((resolve) => { allowTitle = resolve; });
  let releasePostProcessing!: () => void;
  const postProcessingGate = new Promise<void>((resolve) => { releasePostProcessing = resolve; });
  const interruptedAdapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed(request, context) {
      const execution = context.webChatExecution!;
      input.submissionCount.value += 1;
      await execution.onProviderExecutionProfileVerified(fixtureProfileProof(request));
      await execution.onSubmissionObserved({ submission, uploadedFiles: [], attachmentUploadProof });
      await execution.onSubmitted({ submission, uploadedFiles: [], attachmentUploadProof });
      await execution.onResponseCaptured({
        answerText,
        pageUrl: submission.canonicalConversationUrl,
      });
      announceCheckpoint();
      await titleGate;
      assert.ok(execution.conversationTitle, "production GPT execution must own a title finalization state");
      await execution.onConversationTitleFinalizationStarted(submission.canonicalConversationUrl!);
      await execution.onConversationTitleVerified(fixtureTitleProof({
        state: execution.conversationTitle!,
        canonicalConversationUrl: submission.canonicalConversationUrl!,
      }));
      await postProcessingGate;
      throw new Error("review_required: simulated interruption during artifact cleanup");
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir: input.dataDir,
    adapters: { "gpt-web-chat": interruptedAdapter },
  });
  const execution = gateway.execute(input.request, { executionId: input.executionId });
  await checkpointReached;
  await assertPendingTitleCheckpoint({ dataDir: input.dataDir, executionId: input.executionId, execution });
  allowTitle();
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  const titleVerified = await readWebChatExecution(input.dataDir, input.executionId);
  assert.equal(titleVerified?.conversationTitle?.status, "verified");
  releasePostProcessing();
  await assertFinalizedCheckpoint({ dataDir: input.dataDir, executionId: input.executionId, execution });
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
        "a fully finalized checkpoint recovery must finish before browser or provider access",
      );
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir: input.dataDir,
    adapters: { "gpt-web-chat": resumedAdapter },
  });
  const resumed = await gateway.execute(input.request, { executionId: input.executionId });
  assert.equal(
    resumed.status,
    "success",
    resumed.failureReason ?? resumed.reviewRequiredReason ?? "checkpoint resume failed",
  );
  assert.equal(resumed.normalizedText, answerText);
  assert.ok(resumed.providerProof.providerExecutionProfileProof);
  assert.ok(resumed.providerProof.conversationTitleProof);
  assert.match(
    resumed.providerProof.providerLeaseId ?? "",
    /^web-chat-(?:capacity|checkpoint-recovery):/u,
  );
};

export const assertResponseCheckpointRecovery = async (
  dataDir: string,
  request: AiFeedInput,
): Promise<void> => {
  const productionRequest = {
    ...request,
    requestedBy: "ai-capability" as const,
    modelName: null,
  };
  const executionId = "checkpoint-recovery-execution";
  const submissionCount = { value: 0 };
  await captureThenInterruptPostProcessing({
    dataDir,
    executionId,
    request: productionRequest,
    submissionCount,
  });
  await resumeFromCheckpoint({ dataDir, executionId, request: productionRequest });
  assert.equal(submissionCount.value, 1, "recovery must not submit the same provider turn twice");
  assert.equal((await readWebChatExecution(dataDir, executionId))?.status, "finalized");
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
  );
};

const assertTemporaryProviderFailure = async (input: {
  dataDir: string;
  request: AiFeedInput;
  executionId: string;
}): Promise<void> => {
  const adapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed() {
      throw new Error("fixture provider composer unavailable");
    },
  };
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir: input.dataDir,
    adapters: { "gpt-web-chat": adapter },
  });
  const result = await gateway.execute(input.request, { executionId: input.executionId });
  assert.equal(result.status, "recovery_pending");
  const record = await readWebChatExecution(input.dataDir, input.executionId);
  assert.equal(record?.status, "recovery_pending");
  assert.deepEqual(record?.failures.map((failure) => ({
    classification: failure.classification,
    recoverable: failure.recoverable,
    reason: failure.reason,
  })), [{
    classification: "recovery_pending",
    recoverable: true,
    reason: "fixture provider composer unavailable",
  }]);
};

const recoveredFailureSubmission = (executionId: string) => {
  const checkpoint = checkpointFixture();
  return {
    attachmentUploadProof: checkpoint.attachmentUploadProof,
    submission: {
      ...checkpoint.submission,
      executionId,
      turnMarker: "traceable-failure-recovery-turn",
      transientConversationUrl: "https://chatgpt.com/c/traceable-failure-recovery",
      canonicalConversationUrl: "https://chatgpt.com/c/traceable-failure-recovery",
      userTurnId: "traceable-failure-recovery-user-turn",
    },
  };
};

const finalizeFixtureConversationTitle = async (
  execution: WebChatExecutionContext,
  submission: ReturnType<typeof recoveredFailureSubmission>["submission"],
): Promise<WebChatConversationTitleProof | null> => {
  if (!execution.conversationTitle) return null;
  await execution.onConversationTitleFinalizationStarted(submission.canonicalConversationUrl!);
  const proof = fixtureTitleProof({
    state: execution.conversationTitle,
    canonicalConversationUrl: submission.canonicalConversationUrl!,
  });
  await execution.onConversationTitleVerified(proof);
  return proof;
};

const recoverTemporaryProviderFailure = async (input: {
  dataDir: string;
  request: AiFeedInput;
  executionId: string;
}): Promise<void> => {
  const { attachmentUploadProof, submission } = recoveredFailureSubmission(input.executionId);
  const adapter: AiProviderAdapter = {
    providerKind: "gpt-web-chat",
    async feed(request, context) {
      const execution = context.webChatExecution!;
      await execution.onProviderExecutionProfileVerified(fixtureProfileProof(request));
      await execution.onSubmissionObserved({ submission, uploadedFiles: [], attachmentUploadProof });
      await execution.onSubmitted({ submission, uploadedFiles: [], attachmentUploadProof });
      const conversationTitleProof = await finalizeFixtureConversationTitle(execution, submission);
      return {
        rawText: "provider returned after temporary unavailability",
        modelName: request.providerExecutionProfile?.modelDisplayName ?? null,
        providerExecutionProfileProof: execution.providerExecutionProfileProof,
        conversationTitleProof,
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
  const gateway = createAiInputGatewayAbilityGroup({
    dataDir: input.dataDir,
    adapters: { "gpt-web-chat": adapter },
  });
  const recovered = await gateway.execute(input.request, { executionId: input.executionId });
  assert.equal(recovered.status, "success", JSON.stringify({
    failureReason: recovered.failureReason,
    reviewRequiredReason: recovered.reviewRequiredReason,
    providerProof: recovered.providerProof,
  }));
};

export const assertFailureLedger = async (
  dataDir: string,
  request: AiFeedInput,
): Promise<void> => {
  const duplicatePhysicalTab = new Error(
    "review_required: more than one physical provider tab is open.",
  );
  assert.equal(classifyWebChatFailure(duplicatePhysicalTab, false), "review_required");
  assert.equal(
    classifyWebChatFailure(duplicatePhysicalTab, true),
    "review_required",
    "an explicit operator-interference verdict remains review-required after durable submission",
  );
  const executionId = "traceable-failure-execution";
  await assertTemporaryProviderFailure({ dataDir, request, executionId });
  await recoverTemporaryProviderFailure({ dataDir, request, executionId });
  await assertPermanentFailure(dataDir, request);
};
