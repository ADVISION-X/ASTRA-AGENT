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

const runRoot = await mkdtemp(path.join(tmpdir(), "grasseye-real-chrome-parallel-"));
const browser = new CurrentChromeBrowserController({
  sessionConfig: createLocalBrowserSessionConfig({ platform: "darwin" }),
  screenshotDir: path.join(runRoot, "browser-captures"),
});
const gateway = createAiInputGatewayAbilityGroup({ dataDir: runRoot }, browser);
const prepared = await browser.open({
  url: "https://chatgpt.com/",
  title: "prepare one physical ChatGPT tab for named-chat acceptance",
  reusePolicy: "reuse-host-tab",
});
assert.equal(prepared.ok, true, prepared.message);
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
const runId = randomUUID();
const tokens = [
  `PARALLEL_A_${runId.slice(0, 8)}`,
  `PARALLEL_B_${runId.slice(9, 17)}`,
];

const requests = tokens.map((token, index) => ({
  providerKind: "gpt-web-chat" as const,
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
  timeoutMs: 180_000,
  maxInputChars: 2_000,
  maxFileCount: 0,
  maxFileBytes: 1,
  requestedBy: "acceptance-test" as const,
  missionId: "ai-input-gateway-real-chrome-parallel",
  runId: `${runId}:${index + 1}`,
  roundId: `ai-input-gateway-real-chrome-parallel:${runId}:${index + 1}`,
}));

const results = await Promise.all(requests.map((request, index) =>
  gateway.execute(request, { executionId: `real-chrome-parallel:${runId}:${index + 1}` }),
));
for (const [index, result] of results.entries()) {
  assert.equal(result.status, "success", result.failureReason ?? result.reviewRequiredReason ?? "parallel provider feed failed");
  assert.match(result.rawResponseText ?? "", new RegExp(tokens[index]!, "u"));
  assert.doesNotMatch(result.rawResponseText ?? "", new RegExp(tokens[index === 0 ? 1 : 0]!, "u"));
}
assert.notEqual(results[0]?.providerProof.webChatUrl, results[1]?.providerProof.webChatUrl);

const executionDir = path.join(
  runRoot,
  "runtime-data",
  "ai-input-gateway",
  "web-chat-executions",
);
const records = await Promise.all((await readdir(executionDir)).map(async (name) =>
  JSON.parse(await readFile(path.join(executionDir, name), "utf8")) as WebChatExecutionRecord,
));
assert.equal(records.length, 2);
assert.equal(new Set(records.map((record) => record.turnMarker)).size, 2);
assert.equal(new Set(records.map((record) => record.systemChatTitle)).size, 2);
assert.equal(
  records.every((record) =>
    record.systemChatTitle
    && record.submission?.systemChatTitle === record.systemChatTitle
    && Boolean(record.submission.chatTitleVerifiedAt)),
  true,
  "both conversations must be manually renamed and verified before polling",
);
assert.equal(new Set(records.map((record) => record.submission?.canonicalConversationUrl)).size, 2);
assert.equal(records.every((record) => record.status === "response_captured"), true);
const firstResponseCapturedAt = Math.min(...records.map((record) => Date.parse(record.updatedAt)));
assert.equal(
  records.every((record) =>
    record.submission && Date.parse(record.submission.submittedAt) < firstResponseCapturedAt),
  true,
  "both exact marked turns must be submitted before the first response is captured",
);

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
  records: records.map((record) => ({
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
