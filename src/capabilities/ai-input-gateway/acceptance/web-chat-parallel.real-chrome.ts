import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { createAiInputGatewayAbilityGroup } from "../index.js";
import { CurrentChromeBrowserController } from "../../../lib/browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../../../lib/browser/local-browser-session.js";
import { runJxa } from "../../../lib/browser/current-chrome-window-control.js";
import type { WebChatExecutionRecord } from "../runtime/web-chat-execution-state.js";
import { readWebChatResponseCheckpoint } from "../runtime/web-chat-response-checkpoint.js";

const requestedRecoveryRoot =
  process.env.WEB_CHAT_PARALLEL_RECOVERY_RUN_ROOT?.trim() || null;
const runRoot = requestedRecoveryRoot
  ?? await mkdtemp(path.join(tmpdir(), "grasseye-real-chrome-parallel-"));
const executionDir = path.join(
  runRoot,
  "runtime-data",
  "ai-input-gateway",
  "web-chat-executions",
);
const readRecords = async (): Promise<WebChatExecutionRecord[]> =>
  Promise.all((await readdir(executionDir)).map(async (name) =>
    JSON.parse(await readFile(path.join(executionDir, name), "utf8")) as WebChatExecutionRecord,
  ));
const initialRecords = requestedRecoveryRoot ? await readRecords() : [];
const browser = new CurrentChromeBrowserController({
  sessionConfig: createLocalBrowserSessionConfig({ platform: "darwin" }),
  screenshotDir: path.join(runRoot, "browser-captures"),
});
const gateway = createAiInputGatewayAbilityGroup({ dataDir: runRoot }, browser);
if (requestedRecoveryRoot) {
  await browser.getGeometrySnapshot();
} else {
  const prepared = await browser.open({
    url: "https://chatgpt.com/",
    title: "prepare one physical ChatGPT tab for named-chat acceptance",
    reusePolicy: "reuse-host-tab",
  });
  assert.equal(prepared.ok, true, prepared.message);
}
const countChatGptTabs = async (): Promise<number> => Number(await runJxa(`
const chrome = Application("Google Chrome");
let count = 0;
for (const window of chrome.windows()) {
  for (const tab of window.tabs()) {
    const url = String(tab.url() || "");
    if (url === "https://chatgpt.com" || url.startsWith("https://chatgpt.com/")) count += 1;
  }
}
String(count);
`));
const chatGptTabCountBefore = await countChatGptTabs();
assert.equal(
  chatGptTabCountBefore,
  1,
  "real Chrome acceptance requires exactly one physical ChatGPT tab before submission",
);
const recoveredRunId = initialRecords[0]?.executionId.match(
  /^real-chrome-parallel:([^:]+):/u,
)?.[1];
const runId = recoveredRunId ?? randomUUID();
const tokens = Array.from(
  { length: 10 },
  (_, index) => `PARALLEL_${index + 1}_${runId.slice(0, 8)}`,
);

const requests = tokens.map((token, index) => ({
  providerKind: "gpt-web-chat" as const,
  taskIdentity: {
    labelKey: "system_acceptance" as const,
    sourceProject: "agent",
    taskKind: "real-chrome-parallel",
    sourceTaskId: `${runId}:${index + 1}`,
  },
  promptPackageId: `real-chrome-parallel-${index + 1}-${runId}`,
  promptContractId: "real-chrome-parallel-v1",
  expectedOutputSchemaRef: null,
  textPrompt: [
    "这是并发隔离验收。",
    "只回复一个 JSON 对象，不要代码块，不要解释。",
    `token 必须逐字等于 ${token}。`,
    `lane 必须等于 ${index + 1}。`,
  ].join("\n"),
  inputRefs: [],
  modelName: null,
  timeoutMs: 600_000,
  maxInputChars: 2_000,
  maxFileCount: 0,
  maxFileBytes: 1,
  requestedBy: "acceptance-test" as const,
  missionId: "ai-input-gateway-real-chrome-parallel",
  runId: `${runId}:${index + 1}`,
  roundId: `ai-input-gateway-real-chrome-parallel:${runId}:${index + 1}`,
}));

const results = await Promise.all(requests.map(async (request, index) => {
  const executionId = `real-chrome-parallel:${runId}:${index + 1}`;
  const laneRecords = initialRecords.filter((record) =>
    record.executionId === executionId
    || record.executionId.startsWith(`${executionId}:retry:`));
  if (laneRecords.some((record) => record.status === "response_captured")) {
    return null;
  }
  const resumable = laneRecords
    .filter((record) => Boolean(record.submission))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  if (resumable) {
    return gateway.execute(request, { executionId: resumable.executionId });
  }
  if (laneRecords.length > 0) {
    assert.equal(
      process.env.WEB_CHAT_PARALLEL_ALLOW_UNSUBMITTED_RETRY,
      "1",
      `lane ${index + 1} needs explicit approval before retrying a failed pre-submission attempt`,
    );
    return gateway.execute(request, {
      executionId: `${executionId}:retry:${laneRecords.length + 1}`,
    });
  }
  return gateway.execute(request, { executionId });
}));
for (const [index, result] of results.entries()) {
  if (!result) continue;
  assert.equal(result.status, "success", result.failureReason ?? result.reviewRequiredReason ?? "parallel provider feed failed");
  assert.match(result.rawResponseText ?? "", new RegExp(tokens[index]!, "u"));
  for (const [otherIndex, otherToken] of tokens.entries()) {
    if (otherIndex !== index) {
      assert.doesNotMatch(result.rawResponseText ?? "", new RegExp(otherToken, "u"));
    }
  }
}
const records = await readRecords();
const successfulRecords = records.filter((record) => record.status === "response_captured");
const unsuccessfulAttemptRecords = records.filter((record) =>
  !record.submission
  && (record.status === "failed" || record.status === "review_required"));
assert.equal(successfulRecords.length, tokens.length);
assert.equal(new Set(successfulRecords.map((record) => record.turnMarker)).size, tokens.length);
assert.equal(new Set(successfulRecords.map((record) => record.systemChatTitle)).size, tokens.length);
assert.equal(
  successfulRecords.every((record) =>
    record.systemChatTitle
    && record.submission?.systemChatTitle === record.systemChatTitle
    && Boolean(record.submission.chatTitleVerifiedAt)),
  true,
  "all conversations must be manually renamed and verified before publication",
);
assert.equal(new Set(successfulRecords.map((record) => record.submission?.canonicalConversationUrl)).size, tokens.length);
for (const [index, token] of tokens.entries()) {
  const lanePattern = new RegExp(`:${index + 1}(?::retry:\\d+)?$`, "u");
  const record = successfulRecords.find((candidate) =>
    lanePattern.test(candidate.executionId));
  assert.ok(record?.responseCheckpoint, `lane ${index + 1} must have a response checkpoint`);
  assert.match(
    await readWebChatResponseCheckpoint(record.responseCheckpoint),
    new RegExp(token, "u"),
  );
}
if (!requestedRecoveryRoot) {
  const firstResponseCapturedAt = Math.min(...successfulRecords.map((record) => Date.parse(record.updatedAt)));
  assert.equal(
    successfulRecords.every((record) =>
      record.submission && Date.parse(record.submission.submittedAt) < firstResponseCapturedAt),
    true,
    "all exact marked turns must be submitted before the first response is captured",
  );
} else {
  assert.equal(
    unsuccessfulAttemptRecords.every((record) => !record.submission),
    true,
    "recovery may retry only a preserved failed attempt with no durable submission",
  );
}

const chatGptTabCountAfter = await countChatGptTabs();
assert.equal(
  chatGptTabCountAfter,
  1,
  "parallel named conversations must leave exactly one physical ChatGPT tab",
);

process.stdout.write(`${JSON.stringify({
  marker: "[ACCEPTANCE][AI-INPUT-GATEWAY][REAL-CHROME-PARALLEL]",
  runRoot,
  configuredMaxInFlight: process.env.WEB_CHAT_MAX_IN_FLIGHT ?? "default:10",
  physicalChatGptTabCountBefore: chatGptTabCountBefore,
  physicalChatGptTabCountAfter: chatGptTabCountAfter,
  recoveredExistingRun: Boolean(requestedRecoveryRoot),
  preservedFailedAttemptCount: unsuccessfulAttemptRecords.length,
  records: successfulRecords.map((record) => ({
    executionId: record.executionId,
    systemChatTitle: record.systemChatTitle,
    turnMarker: record.turnMarker,
    observedAutoChatTitle: record.submission?.observedAutoChatTitle ?? null,
    chatTitleVerifiedAt: record.submission?.chatTitleVerifiedAt ?? null,
    submittedAt: record.submission?.submittedAt ?? null,
    canonicalConversationUrl: record.submission?.canonicalConversationUrl ?? null,
    responseCapturedAt: record.updatedAt,
    status: record.status,
  })),
}, null, 2)}\n`);
