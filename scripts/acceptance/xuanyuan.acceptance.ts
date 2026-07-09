import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type {
  AiFeedInput,
  AiFeedResult,
  AiInputGatewayAbilityGroup,
} from "../../src/capabilities/ai-input-gateway/index.js";
import {
  getLatestXuanyuanTask,
  getXuanyuanTaskStatus,
  listXuanyuanHistory,
  startXuanyuanTask,
  startXuanyuanTaskAsync,
} from "../../src/plugins/xuanyuan/index.js";

const buildFixtureGateway = (rawText: string): AiInputGatewayAbilityGroup => ({
  abilityGroupId: "ai-input-gateway",
  listChildCapabilityIds: () => ["feed-gpt-web-chat-once"],
  async execute(input: unknown): Promise<AiFeedResult> {
    const request = input as AiFeedInput;
    return {
      abilityGroupId: "ai-input-gateway",
      childCapabilityId: "feed-gpt-web-chat-once",
      providerKind: "gpt-web-chat",
      status: request.expectedOutputSchemaRef && !rawText.trim().startsWith("{") ? "failed" : "success",
      normalizedText: rawText,
      rawOutputRef: path.join(tmpdir(), "xuanyuan-fixture-output.txt"),
      rawOutputHash: "fixture-output-hash",
      parseStatus: request.expectedOutputSchemaRef && rawText.trim().startsWith("{") ? "json_valid" : request.expectedOutputSchemaRef ? "json_invalid" : "not_requested",
      parsedJson: rawText.trim().startsWith("{") ? JSON.parse(rawText) as unknown : null,
      schemaValidationStatus: request.expectedOutputSchemaRef && rawText.trim().startsWith("{") ? "not_applicable" : request.expectedOutputSchemaRef ? "invalid" : "not_applicable",
      providerProof: {
        providerKind: "gpt-web-chat",
        modelName: null,
        inputHash: "fixture-input-hash",
        outputHash: "fixture-output-hash",
        inputRefs: request.inputRefs.map((ref) => ref.id),
        outputRefs: [],
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        durationMs: 1,
        transport: "web-chat",
        webChatUrl: "https://chatgpt.com/",
        sourcePageUrlBeforeFeed: null,
        restoredSourcePage: null,
        retryCount: 0,
        cooldownMs: 0,
        estimatedInputTokens: null,
        estimatedOutputTokens: null,
        tokenEstimateUnavailableReason: "fixture",
      },
      failureReason: request.expectedOutputSchemaRef && !rawText.trim().startsWith("{") ? "AI feed output failed requested parsing." : null,
      reviewRequiredReason: null,
    };
  },
});

const dataDir = await mkdtemp(path.join(tmpdir(), "xuanyuan-acceptance-"));
try {
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
    inputRefs: [{ id: "ref-1", kind: "evidence_pack", summary: "fixture evidence pack" }],
    timeoutMs: 1000,
    maxInputChars: 1000,
    maxFileCount: 0,
    maxFileBytes: 1,
  });

  assert.equal(succeeded.jobId, "xuanyuan");
  assert.equal(succeeded.status, "succeeded");
  assert.equal(succeeded.providerKind, "gpt-web-chat");
  assert.equal(succeeded.rawOutputHash, "fixture-output-hash");
  assert.equal(succeeded.providerProof?.inputHash, "fixture-input-hash");
  assert.deepEqual(succeeded.parsedJson, { answer: "ok" });

  const persisted = await getXuanyuanTaskStatus({ dataDir }, succeeded.taskId);
  assert.equal(persisted?.taskId, succeeded.taskId);
  assert.equal((await getLatestXuanyuanTask({ dataDir }))?.taskId, succeeded.taskId);
  assert.equal((await listXuanyuanHistory({ dataDir })).length, 1);
  assert.match(await readFile(path.join(dataDir, "runtime-data", "xuanyuan", "tasks", `${succeeded.taskId}.json`), "utf8"), /promptPackageSnapshot/);

  const failed = await startXuanyuanTask({
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
  assert.equal(failed.status, "parse_failed_raw_available");
  assert.notEqual(failed.status, "succeeded");

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
