import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { CurrentChromeBrowserController } from "../../../lib/browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../../../lib/browser/local-browser-session.js";
import { createAiInputGatewayAbilityGroup } from "../index.js";
import type { WebChatExecutionRecord } from "../runtime/web-chat-execution-state.js";

const requestedRecoveryRoot =
  process.env.WEB_CHAT_RECOVERY_RUN_ROOT?.trim() || null;
const runRoot = requestedRecoveryRoot
  ?? await mkdtemp(path.join(tmpdir(), "grasseye-real-chrome-restart-"));
const executionDir = path.join(
  runRoot,
  "runtime-data",
  "ai-input-gateway",
  "web-chat-executions",
);
const readOnlyExecution = async (): Promise<WebChatExecutionRecord> => {
  const names = await readdir(executionDir);
  assert.equal(names.length, 1);
  return JSON.parse(
    await readFile(path.join(executionDir, names[0]!), "utf8"),
  ) as WebChatExecutionRecord;
};
const existingRecord = requestedRecoveryRoot
  ? await readOnlyExecution()
  : null;
const browser = new CurrentChromeBrowserController({
  sessionConfig: createLocalBrowserSessionConfig({ platform: "darwin" }),
  screenshotDir: path.join(runRoot, "browser-captures"),
});
if (existingRecord) {
  const geometry = await browser.getGeometrySnapshot();
  assert.equal(
    geometry.currentUrl,
    existingRecord.submission?.canonicalConversationUrl,
    "the existing recovery conversation must remain the controlled page",
  );
} else {
  const prepared = await browser.open({
    url: "https://chatgpt.com/",
    title: "prepare ChatGPT for exact restart recovery acceptance",
    reusePolicy: "reuse-host-tab",
  });
  assert.equal(prepared.ok, true, prepared.message);
}

const runId = existingRecord
  ? existingRecord.executionId.replace(/^real-chrome-restart:/u, "")
  : randomUUID();
const executionId = existingRecord?.executionId
  ?? `real-chrome-restart:${runId}`;
const token = `RESTART_RECOVERY_${runId.slice(0, 8)}`;
const request = {
  providerKind: "gpt-web-chat" as const,
  taskIdentity: {
    labelKey: "system_acceptance" as const,
    sourceProject: "agent",
    taskKind: "real-chrome-restart-recovery",
    sourceTaskId: runId,
  },
  promptPackageId: `real-chrome-restart-${runId}`,
  promptContractId: "real-chrome-restart-recovery-v1",
  expectedOutputSchemaRef: null,
  textPrompt: [
    "这是跨进程断点恢复验收。",
    "只回复一个 JSON 对象，不要代码块，不要解释。",
    `token 必须逐字等于 ${token}。`,
    "recovered 必须等于 true。",
  ].join("\n"),
  inputRefs: [],
  modelName: null,
  timeoutMs: 240_000,
  maxInputChars: 2_000,
  maxFileCount: 0,
  maxFileBytes: 1,
  requestedBy: "acceptance-test" as const,
  missionId: "ai-input-gateway-real-chrome-restart",
  runId,
  roundId: `ai-input-gateway-real-chrome-restart:${runId}`,
};

let originalSubmission = existingRecord?.submission ?? null;
if (!existingRecord) {
  const abortController = new AbortController();
  let submittedProgressCount = 0;
  const firstGateway = createAiInputGatewayAbilityGroup({ dataDir: runRoot }, browser);
  const interrupted = await firstGateway.execute(request, {
    executionId,
    signal: abortController.signal,
    onProgress: async ({ phase }) => {
      if (phase === "waiting_provider") {
        submittedProgressCount += 1;
        abortController.abort("simulate process interruption after durable submit");
      }
    },
  });
  assert.notEqual(interrupted.status, "success");
  assert.equal(
    submittedProgressCount,
    1,
    interrupted.failureReason
      ?? interrupted.reviewRequiredReason
      ?? "provider submit progress was never recorded",
  );
  const interruptedRecord = await readOnlyExecution();
  assert.equal(interruptedRecord.status, "recovery_pending");
  assert.ok(interruptedRecord.submission?.canonicalConversationUrl);
  originalSubmission = interruptedRecord.submission!;
}
assert.ok(originalSubmission?.canonicalConversationUrl);

const restartedGateway = createAiInputGatewayAbilityGroup({ dataDir: runRoot }, browser);
const recovered = await restartedGateway.execute(request, { executionId });
assert.equal(
  recovered.status,
  "success",
  recovered.failureReason ?? recovered.reviewRequiredReason ?? "restart recovery failed",
);
assert.match(recovered.rawResponseText ?? "", new RegExp(token, "u"));
const recoveredRecord = await readOnlyExecution();
assert.equal(recoveredRecord.status, "response_captured");
assert.ok(recoveredRecord.responseCheckpoint);
assert.equal(recoveredRecord.submission?.submittedAt, originalSubmission.submittedAt);
assert.equal(
  recoveredRecord.submission?.canonicalConversationUrl,
  originalSubmission.canonicalConversationUrl,
);
assert.ok(
  recoveredRecord.systemChatTitle,
  "the planned human-readable title may remain pending but must stay recorded",
);

const markerProbe = await browser.evaluateActiveTab<{ markerCount: number }>({
  description: "prove restart recovery kept exactly one submitted marked turn",
  script: `
const marker = ${JSON.stringify(recoveredRecord.turnMarker)};
const nodes = Array.from(document.querySelectorAll("[data-message-author-role='user'], user-query, user-query-content, .user-query-container"));
return { markerCount: nodes.filter((node) => (node.textContent || "").includes(marker)).length };
`,
});
assert.equal(markerProbe.markerCount, 1, "restart recovery must not submit a duplicate prompt");

process.stdout.write(`${JSON.stringify({
  marker: "[ACCEPTANCE][AI-INPUT-GATEWAY][REAL-CHROME-RESTART-RECOVERY]",
  runRoot,
  executionId,
  systemChatTitle: recoveredRecord.systemChatTitle,
  canonicalConversationUrl: recoveredRecord.submission?.canonicalConversationUrl ?? null,
  submittedAt: recoveredRecord.submission?.submittedAt ?? null,
  responseCheckpoint: recoveredRecord.responseCheckpoint,
  responseCapturedAt: recoveredRecord.updatedAt,
  exactMarkedUserTurnCount: markerProbe.markerCount,
  status: recoveredRecord.status,
}, null, 2)}\n`);
