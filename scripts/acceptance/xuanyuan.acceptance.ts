import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayAbilityGroup,
  AiProviderUploadedFileProof,
  WebChatAttachmentUploadProof,
} from "../../src/capabilities/ai-input-gateway/index.js";
import {
  getLatestXuanyuanTask,
  getXuanyuanTaskStatus,
  listXuanyuanHistory,
  startXuanyuanTask,
  startXuanyuanTaskAsync,
} from "../../src/plugins/xuanyuan/index.js";
import { runSpawn } from "../../src/lib/browser/current-chrome-window-control.js";

const splitUtf8Output = await runSpawn(process.execPath, [
  "-e",
  "const bytes=Buffer.from('你');process.stdout.write(bytes.subarray(0,1));setTimeout(()=>process.stdout.write(bytes.subarray(1)),10);",
]);
assert.equal(splitUtf8Output, "你", "Chrome/JXA stdout must preserve a UTF-8 character split across stream chunks");

const buildUploadedFiles = (request: AiFeedInput): AiProviderUploadedFileProof[] =>
  request.inputRefs
    .filter((ref) => ref.filePath)
    .map((ref, index) => ({
      inputRefId: ref.id,
      step: index + 1,
      expectedAttachmentCount: request.inputRefs.length,
      detectedAttachmentCount: request.inputRefs.length,
      fileName: ref.fileName!,
      sha256: ref.sha256! as `sha256:${string}`,
      byteCount: ref.byteCount!,
    }));

const buildAttachmentUploadProof = (
  uploadedFiles: AiProviderUploadedFileProof[],
): WebChatAttachmentUploadProof => ({
  childCapabilityId: "attach-approved-web-chat-files-once",
  uploadAttemptId: "fixture-upload-attempt",
  transportKind: uploadedFiles.length >= 2
    ? "native_picker_batch"
    : uploadedFiles.length === 1
      ? "ordered_clipboard"
      : "skipped",
  expectedFileCount: uploadedFiles.length,
  detectedFileCount: uploadedFiles.length,
  stagingManifestHash: uploadedFiles.length > 0 ? `sha256:${"a".repeat(64)}` : null,
  files: uploadedFiles.map((proof) => ({
    inputRefId: proof.inputRefId,
    order: proof.step,
    sourceFileName: proof.fileName,
    displayFileName: proof.fileName,
    sha256: proof.sha256,
    byteCount: proof.byteCount,
  })),
  startedAt: new Date().toISOString(),
  endedAt: new Date().toISOString(),
  status: uploadedFiles.length > 0 ? "attachments_stable" : "skipped",
  failureReason: null,
  reviewRequiredReason: null,
});

const buildFixtureFeedResult = (input: {
  request: AiFeedInput;
  rawText: string;
  uploadedFiles: AiProviderUploadedFileProof[];
  attachmentUploadProof: WebChatAttachmentUploadProof;
}): AiFeedResult => ({
  abilityGroupId: "ai-input-gateway",
  childCapabilityId: "feed-gpt-web-chat-once",
  providerKind: "gpt-web-chat",
  status: "success",
  rawResponseText: input.rawText,
  transportWarnings: [],
  normalizedText: input.rawText,
  rawOutputRef: path.join(tmpdir(), "xuanyuan-fixture-output.txt"),
  rawOutputHash: "fixture-output-hash",
  parseStatus: "not_requested",
  parsedJson: null,
  schemaValidationStatus: "not_applicable",
  providerProof: {
    providerKind: "gpt-web-chat",
    providerLeaseId: "fixture-provider-lease",
    modelName: null,
    inputHash: "fixture-input-hash",
    outputHash: "fixture-output-hash",
    inputRefs: input.request.inputRefs.map((ref) => ref.id),
    uploadedFileRefs: input.uploadedFiles.map((proof) => proof.inputRefId),
    uploadedFiles: input.uploadedFiles,
    attachmentUploadProof: input.attachmentUploadProof,
    outputRefs: [],
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: 1,
    transport: "web-chat",
    webChatUrl: input.request.providerContinuationRef?.providerPageUrl
      ?? "https://chatgpt.com/c/xuanyuan-fixture",
    continuationPriorTaskId: input.request.providerContinuationRef?.priorTaskId ?? null,
    continuationPriorRawOutputHash: input.request.providerContinuationRef?.priorRawOutputHash ?? null,
    continuationRequestedUrl: input.request.providerContinuationRef?.providerPageUrl ?? null,
    continuationActualUrl: input.request.providerContinuationRef?.providerPageUrl ?? null,
    continuationVerified: input.request.providerContinuationRef ? true : null,
    sourcePageUrlBeforeFeed: null,
    restoredSourcePage: null,
    retryCount: 0,
    cooldownMs: 0,
    estimatedInputTokens: null,
    estimatedOutputTokens: null,
    tokenEstimateUnavailableReason: "fixture",
    transportWarnings: [],
  },
  failureReason: null,
  reviewRequiredReason: null,
});

const buildFixtureGateway = (rawText: string): AiInputGatewayAbilityGroup => ({
  abilityGroupId: "ai-input-gateway",
  listChildCapabilityIds: () => ["feed-gpt-web-chat-once"],
  async execute(input: unknown, options): Promise<AiFeedResult> {
    const request = input as AiFeedInput;
    const uploadedFiles = buildUploadedFiles(request);
    const attachmentUploadProof = buildAttachmentUploadProof(uploadedFiles);
    await options?.onAttachmentUploadCompleted?.(attachmentUploadProof);
    return buildFixtureFeedResult({
      request,
      rawText,
      uploadedFiles,
      attachmentUploadProof,
    });
  },
});

const dataDir = await mkdtemp(path.join(tmpdir(), "xuanyuan-acceptance-"));
try {
  const webChatOpenSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-open.ts"),
    "utf8",
  );
  const freshConversationScriptSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-fresh-conversation-script.ts"),
    "utf8",
  );
  const webChatClipboardSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-clipboard.ts"),
    "utf8",
  );
  const attachmentCapabilitySource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/children/attach-approved-web-chat-files-once.ts"),
    "utf8",
  );
  const webChatComposerScriptsSource = await readFile(
    path.resolve("src/capabilities/ai-input-gateway/providers/web-chat-composer-scripts.ts"),
    "utf8",
  );
  for (const requiredFreshConversationGuard of [
    "CHATGPT_FRESH_CONVERSATION_SCRIPT",
    "waitForFreshChatGptConversation",
    "ChatGPT fresh conversation was not established",
  ]) {
    assert.equal(
      webChatOpenSource.includes(requiredFreshConversationGuard),
      true,
      `Xuanyuan GPT transport must fail closed unless the fresh-conversation guard contains ${requiredFreshConversationGuard}`,
    );
  }
  for (const requiredProbeGuard of ["[data-message-author-role=\"assistant\"]", "assistantCount === 0"]) {
    assert.equal(freshConversationScriptSource.includes(requiredProbeGuard), true, `Fresh-conversation probe must contain ${requiredProbeGuard}`);
  }
  for (const requiredOneByOneClipboardGuard of [
    "tell process \"Finder\"",
    "keystroke \"c\" using command down",
    "keystroke \"v\" using command down",
  ]) {
    assert.equal(webChatClipboardSource.includes(requiredOneByOneClipboardGuard), true, `Xuanyuan Web Chat file delivery must contain ${requiredOneByOneClipboardGuard}`);
  }
  for (const requiredAttachmentGuard of [
    "attachApprovedWebChatFilesOnce",
    "native_picker_batch",
    "ordered_clipboard",
    "waitForStableAttachmentSet",
  ]) {
    assert.equal(attachmentCapabilitySource.includes(requiredAttachmentGuard), true, `Xuanyuan Web Chat attachment child must contain ${requiredAttachmentGuard}`);
  }
  for (const requiredExactCountGuard of [
    "buildWaitForExactAttachmentCountScript",
    "result.count === expectedCount",
    "result.count > expectedCount",
  ]) {
    assert.equal(webChatComposerScriptsSource.includes(requiredExactCountGuard), true, `Xuanyuan Web Chat exact attachment guard must contain ${requiredExactCountGuard}`);
  }
  assert.equal(attachmentCapabilitySource.includes("fallback"), false, "Xuanyuan Web Chat attachment child must not fallback between transports");

  const succeeded = await startXuanyuanTask({
    dataDir,
    aiInputGateway: buildFixtureGateway("{\"answer\":\"ok\"}"),
  }, {
    requestId: "acceptance-request-1",
    sourceProject: "xuanxue-web",
    scenario: "bazi_daily_mode",
    providerKind: "gpt-web-chat",
    promptPackageId: "acceptance-prompt-package",
    promptContractId: "acceptance-contract",
    expectedOutputSchemaRef: "schema:xuanyuan.acceptance",
    textPrompt: "Return JSON.",
    inputRefs: [{
      id: "ref-1",
      kind: "evidence_pack",
      summary: "fixture evidence pack",
      filePath: "/tmp/xuanyuan-acceptance-fixture.json",
      fileName: "fixture.json",
      sha256: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      byteCount: 1,
    }],
    timeoutMs: 1000,
    maxInputChars: 1000,
    maxFileCount: 1,
    maxFileBytes: 1,
  });

  assert.equal(succeeded.jobId, "xuanyuan");
  assert.equal(succeeded.status, "response_captured");
  assert.equal(succeeded.providerKind, "gpt-web-chat");
  assert.equal(succeeded.rawOutputHash, "fixture-output-hash");
  assert.equal(succeeded.providerProof?.inputHash, "fixture-input-hash");
  assert.equal(succeeded.providerProof?.providerLeaseId, "fixture-provider-lease");
  assert.equal(succeeded.rawResponseText, "{\"answer\":\"ok\"}");
  assert.equal(succeeded.progress.attachmentUploadProof?.status, "attachments_stable");
  assert.equal(succeeded.progress.attachmentUploadProof?.expectedFileCount, 1);
  assert.equal(succeeded.progress.attachmentUploadProof?.detectedFileCount, 1);

  const continued = await startXuanyuanTask({
    dataDir,
    aiInputGateway: buildFixtureGateway("{\"continued\":\"ok\"}"),
  }, {
    requestId: "acceptance-request-continuation",
    sourceProject: "xuanxue-web",
    scenario: "bazi_question_analysis",
    providerKind: "gpt-web-chat",
    promptPackageId: "acceptance-prompt-package-continuation",
    promptContractId: "acceptance-contract-continuation",
    expectedOutputSchemaRef: "schema:xuanyuan.acceptance",
    textPrompt: "Continue in the same conversation.",
    inputRefs: [],
    timeoutMs: 1000,
    maxInputChars: 1000,
    maxFileCount: 0,
    maxFileBytes: 1,
    continuationTaskId: succeeded.taskId,
    continuationResponseHash: succeeded.rawOutputHash!,
  });
  assert.equal(continued.status, "response_captured");
  assert.equal(continued.continuationTaskId, succeeded.taskId);
  assert.equal(continued.conversationProof?.verified, true);
  assert.equal(continued.conversationProof?.requestedProviderPageUrl, succeeded.providerProof?.webChatUrl);

  await assert.rejects(() => startXuanyuanTask({
    dataDir,
    aiInputGateway: buildFixtureGateway("must-not-run"),
  }, {
    requestId: "acceptance-request-invalid-continuation",
    sourceProject: "xuanxue-web",
    scenario: "bazi_question_analysis",
    providerKind: "gpt-web-chat",
    promptPackageId: "acceptance-prompt-package-invalid-continuation",
    promptContractId: "acceptance-contract-continuation",
    expectedOutputSchemaRef: null,
    textPrompt: "Must fail before transport.",
    inputRefs: [],
    timeoutMs: 1000,
    maxInputChars: 1000,
    maxFileCount: 0,
    maxFileBytes: 1,
    continuationTaskId: succeeded.taskId,
    continuationResponseHash: "wrong-hash",
  }), /XUANYUAN_CONTINUATION_RESPONSE_HASH_MISMATCH/);

  const persisted = await getXuanyuanTaskStatus({ dataDir }, succeeded.taskId);
  assert.equal(persisted?.taskId, succeeded.taskId);
  assert.equal((await getLatestXuanyuanTask({ dataDir }))?.taskId, continued.taskId);
  assert.equal((await listXuanyuanHistory({ dataDir })).length, 2);
  assert.match(await readFile(path.join(dataDir, "runtime-data", "xuanyuan", "tasks", `${succeeded.taskId}.json`), "utf8"), /promptPackageSnapshot/);

  const invalidJsonCaptured = await startXuanyuanTask({
    dataDir,
    aiInputGateway: buildFixtureGateway("not json"),
  }, {
    requestId: "acceptance-request-2",
    sourceProject: "xuanxue-web",
    scenario: "bazi_daily_mode",
    providerKind: "gpt-web-chat",
    promptPackageId: "acceptance-prompt-package-2",
    promptContractId: "acceptance-contract",
    expectedOutputSchemaRef: "schema:xuanyuan.acceptance",
    textPrompt: "Return JSON.",
    inputRefs: [],
    timeoutMs: 1000,
    maxInputChars: 1000,
    maxFileCount: 0,
    maxFileBytes: 1,
  });
  assert.equal(invalidJsonCaptured.status, "response_captured");
  assert.equal(invalidJsonCaptured.rawResponseText, "not json");
  assert.equal(invalidJsonCaptured.failureReason, null);

  const asyncStarted = await startXuanyuanTaskAsync({
    dataDir,
    aiInputGateway: buildFixtureGateway("{\"async\":\"ok\"}"),
  }, {
    requestId: "acceptance-request-3",
    sourceProject: "xuanxue-web",
    scenario: "bazi_daily_mode",
    providerKind: "gpt-web-chat",
    promptPackageId: "acceptance-prompt-package-3",
    promptContractId: "acceptance-contract",
    expectedOutputSchemaRef: "schema:xuanyuan.acceptance",
    textPrompt: "Return JSON.",
    inputRefs: [],
    timeoutMs: 1000,
    maxInputChars: 1000,
    maxFileCount: 0,
    maxFileBytes: 1,
  });
  assert.equal(asyncStarted.status, "running");
} finally {
  await rm(dataDir, { recursive: true, force: true });
}

process.stdout.write("[ACCEPTANCE][xuanyuan] PASS\n");
