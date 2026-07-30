import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { CurrentChromeBrowserController } from "../../../lib/browser/current-chrome-browser-controller.js";
import { createLocalBrowserSessionConfig } from "../../../lib/browser/local-browser-session.js";
import { createAiInputGatewayAbilityGroup } from "../index.js";
import {
  readWebChatExecution,
  type WebChatExecutionRecord,
} from "../runtime/web-chat-execution-state.js";

const recoveryRoot =
  process.env.WEB_CHAT_TITLE_HOUSEKEEPING_RECOVERY_ROOT?.trim() || null;
const runRoot = recoveryRoot
  ?? await mkdtemp(
    path.join(tmpdir(), "grasseye-real-chrome-title-housekeeping-"),
  );
const executionDir = path.join(
  runRoot,
  "runtime-data",
  "ai-input-gateway",
  "web-chat-executions",
);

const readOnlyExecution = async (): Promise<WebChatExecutionRecord> => {
  const names = (await readdir(executionDir))
    .filter((name) => name.endsWith(".json"));
  assert.equal(names.length, 1);
  return JSON.parse(
    await readFile(path.join(executionDir, names[0]!), "utf8"),
  ) as WebChatExecutionRecord;
};

const browser = new CurrentChromeBrowserController({
  sessionConfig: createLocalBrowserSessionConfig({ platform: "darwin" }),
  screenshotDir: path.join(runRoot, "browser-captures"),
});
const interruptedRecord = recoveryRoot
  ? await readOnlyExecution()
  : null;
if (interruptedRecord) {
  assert.equal(
    interruptedRecord.status === "response_checkpointed"
      || interruptedRecord.status === "response_captured",
    true,
  );
  assert.equal(interruptedRecord.chatTitleRename?.status, "pending");
  assert.ok(interruptedRecord.responseCheckpoint);
  assert.ok(interruptedRecord.submission?.canonicalConversationUrl);
} else {
  const prepared = await browser.open({
    url: "https://chatgpt.com/",
    title: "prepare ChatGPT for durable title-housekeeping restart acceptance",
    reusePolicy: "reuse-host-tab",
  });
  assert.equal(prepared.ok, true, prepared.message);
}

const runId = interruptedRecord
  ? interruptedRecord.executionId.replace(
      /^real-chrome-title-housekeeping:/u,
      "",
    )
  : randomUUID();
const executionId = interruptedRecord?.executionId
  ?? `real-chrome-title-housekeeping:${runId}`;
const token = `TITLE_HOUSEKEEPING_${runId.slice(0, 8)}`;
const request = {
  providerKind: "gpt-web-chat" as const,
  taskIdentity: {
    labelKey: "system_acceptance" as const,
    sourceProject: "agent",
    taskKind: "real-chrome-title-housekeeping-restart",
    sourceTaskId: runId,
  },
  promptPackageId: `real-chrome-title-housekeeping-${runId}`,
  promptContractId: "real-chrome-title-housekeeping-restart-v1",
  expectedOutputSchemaRef: null,
  textPrompt: [
    "这是聊天名称持久尾工的跨进程验收。",
    "只回复一个 JSON 对象，不要代码块，不要解释。",
    `token 必须逐字等于 ${token}。`,
    "durable_title_housekeeping 必须等于 true。",
  ].join("\n"),
  inputRefs: [],
  modelName: null,
  timeoutMs: 240_000,
  maxInputChars: 2_000,
  maxFileCount: 0,
  maxFileBytes: 1,
  requestedBy: "acceptance-test" as const,
  missionId: "ai-input-gateway-real-chrome-title-housekeeping",
  runId,
  roundId: `ai-input-gateway-real-chrome-title-housekeeping:${runId}`,
};

if (!interruptedRecord) {
  const gateway = createAiInputGatewayAbilityGroup(
    { dataDir: runRoot },
    browser,
  );
  await gateway.execute(request, {
    executionId,
    onProgress: async ({ phase }) => {
      if (phase !== "response_checkpointed") return;
      const checkpointed = await readWebChatExecution(
        runRoot,
        executionId,
      );
      assert.equal(checkpointed?.status, "response_checkpointed");
      assert.equal(checkpointed.chatTitleRename?.status, "pending");
      assert.ok(checkpointed.responseCheckpoint);
      await new Promise<void>((resolve) => {
        process.stdout.write(`${JSON.stringify({
          marker:
            "[ACCEPTANCE][AI-INPUT-GATEWAY]"
            + "[REAL-CHROME-TITLE-HOUSEKEEPING-INTERRUPTED]",
          runRoot,
          executionId,
          canonicalConversationUrl:
            checkpointed.submission?.canonicalConversationUrl ?? null,
          status: checkpointed.status,
          chatTitleRename: checkpointed.chatTitleRename,
          nextCommand:
            `WEB_CHAT_TITLE_HOUSEKEEPING_RECOVERY_ROOT=${runRoot}`
            + " npm run "
            + "acceptance:ai-input-gateway-web-chat-title-housekeeping-restart:real-chrome",
        }, null, 2)}\n`, () => {
          process.exit(86);
          resolve();
        });
      });
    },
  });
  throw new Error(
    "real Chrome title-housekeeping interruption did not stop the process",
  );
}

const gateway = createAiInputGatewayAbilityGroup(
  { dataDir: runRoot },
  browser,
);
const recovered = await gateway.execute(request, { executionId });
assert.equal(
  recovered.status,
  "success",
  recovered.failureReason
    ?? recovered.reviewRequiredReason
    ?? "checkpoint publication after restart failed",
);
assert.match(recovered.rawResponseText ?? "", new RegExp(token, "u"));

const renameDeadline = Date.now() + 240_000;
let recoveredRecord = await readOnlyExecution();
while (
  recoveredRecord.chatTitleRename?.status === "pending"
  && Date.now() < renameDeadline
) {
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
  recoveredRecord = await readOnlyExecution();
}
assert.equal(recoveredRecord.status, "response_captured");
assert.equal(
  recoveredRecord.chatTitleRename?.status,
  "verified",
  recoveredRecord.chatTitleRename?.lastFailureReason
    ?? "durable title housekeeping did not finish after restart",
);
assert.equal(
  recoveredRecord.submission?.canonicalConversationUrl,
  interruptedRecord.submission?.canonicalConversationUrl,
);
assert.equal(
  recoveredRecord.submission?.submittedAt,
  interruptedRecord.submission?.submittedAt,
);
assert.equal(
  recoveredRecord.submission?.systemChatTitle,
  recoveredRecord.systemChatTitle,
);
assert.ok(recoveredRecord.submission?.chatTitleVerifiedAt);

const markerProbe = await browser.evaluateActiveTab<{
  markerCount: number;
  pageUrl: string;
}>({
  description:
    "prove title-housekeeping restart retained the exact original GPT turn",
  script: `
const marker = ${JSON.stringify(recoveredRecord.turnMarker)};
const nodes = Array.from(document.querySelectorAll(
  "[data-message-author-role='user']"
));
return {
  markerCount: nodes.filter((node) =>
    (node.textContent || "").includes(marker)
  ).length,
  pageUrl: location.href,
};
`,
});
assert.equal(markerProbe.markerCount, 1);
assert.equal(
  new URL(markerProbe.pageUrl).pathname,
  new URL(recoveredRecord.submission.canonicalConversationUrl!).pathname,
);

process.stdout.write(`${JSON.stringify({
  marker:
    "[ACCEPTANCE][AI-INPUT-GATEWAY]"
    + "[REAL-CHROME-TITLE-HOUSEKEEPING-RECOVERED]",
  runRoot,
  executionId,
  canonicalConversationUrl:
    recoveredRecord.submission.canonicalConversationUrl,
  systemChatTitle: recoveredRecord.systemChatTitle,
  submittedAt: recoveredRecord.submission.submittedAt,
  chatTitleVerifiedAt:
    recoveredRecord.submission.chatTitleVerifiedAt,
  exactMarkedUserTurnCount: markerProbe.markerCount,
  responseStatus: recoveredRecord.status,
  renameStatus: recoveredRecord.chatTitleRename.status,
}, null, 2)}\n`);
