import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { CurrentChromeBrowserController } from "../../../lib/browser/current-chrome-browser-controller.js";
import { runJxa } from "../../../lib/browser/current-chrome-window-control.js";
import { createLocalBrowserSessionConfig } from "../../../lib/browser/local-browser-session.js";
import { createAiInputGatewayAbilityGroup } from "../index.js";
import type { AiFeedInput, AiFeedResult } from "../schema.js";

const runId = randomUUID();
const runRoot = await mkdtemp(path.join(tmpdir(), "grasseye-real-chrome-fork-"));
await runJxa(`
const chrome = Application("Google Chrome");
for (const window of chrome.windows()) {
  for (const tab of [...window.tabs()].reverse()) {
    const title = String(tab.title() || "");
    if (title.includes("Provider checkpoint 分叉验收")) tab.close();
  }
}
"closed governed fork acceptance leftovers";
`);
const browser = new CurrentChromeBrowserController({
  sessionConfig: createLocalBrowserSessionConfig({ platform: "darwin" }),
  screenshotDir: path.join(runRoot, "browser-captures"),
});
const opened = await browser.open({
  url: "https://chatgpt.com/",
  title: "prepare ChatGPT for exact checkpoint fork acceptance",
  reusePolicy: "reuse-host-tab",
});
assert.equal(opened.ok, true, opened.message);
const gateway = createAiInputGatewayAbilityGroup({ dataDir: runRoot }, browser);

const request = (
  sourceTaskId: string,
  token: string,
  scope: string,
): AiFeedInput => ({
  providerKind: "gpt-web-chat",
  taskIdentity: {
    labelKey: "system_acceptance",
    sourceProject: "agent",
    taskKind: "real-chrome-checkpoint-fork",
    sourceTaskId,
  },
  promptPackageId: `real-chrome-fork:${sourceTaskId}`,
  promptContractId: "real-chrome-checkpoint-fork-v1",
  expectedOutputSchemaRef: null,
  expectedOutputKind: "text",
  textPrompt: [
    "这是 provider checkpoint 分叉验收。",
    "只回复一个 JSON 对象，不要代码块，不要解释。",
    `token 必须逐字等于 ${token}。`,
  ].join("\n"),
  inputRefs: [],
  modelName: null,
  timeoutMs: 300_000,
  maxInputChars: 2_000,
  maxFileCount: 0,
  maxFileBytes: 1,
  requestedBy: "acceptance-test",
  missionId: "ai-input-gateway-real-chrome-fork",
  runId,
  roundId: sourceTaskId,
  conversationScopeRef: scope,
});

const baseToken = `FORK_BASE_${runId.slice(0, 8)}`;
const baseRequest = request("base", baseToken, `scope:${runId}:base`);
const base = await gateway.execute(baseRequest, {
  executionId: `real-chrome-fork:${runId}:base`,
});
assert.equal(
  base.status,
  "success",
  base.failureReason ?? base.reviewRequiredReason ?? "base feed failed",
);
assert.equal(base.providerProof.conversationMode, "fresh");
assert.ok(base.providerProof.freshConversationProof);
assert.ok(base.rawOutputHash);
assert.ok(base.providerProof.webChatUrl);

const forkRef = {
  priorTaskId: `real-chrome-fork:${runId}:base`,
  priorRawOutputHash: base.rawOutputHash,
  providerPageUrl: base.providerProof.webChatUrl,
  checkpointTurnMarker:
    base.providerProof.freshConversationProof.firstTurnMarker,
  checkpointResponseHash: base.rawOutputHash,
  parentConversationScopeRef: `scope:${runId}:base`,
} as const;

const childTokens = [
  `FORK_CHILD_A_${runId.slice(0, 8)}`,
  `FORK_CHILD_B_${runId.slice(0, 8)}`,
] as const;
const childRequests = childTokens.map((token, index) => ({
  ...request(
    `child-${index + 1}`,
    token,
    `scope:${runId}:child-${index + 1}`,
  ),
  providerForkRef: forkRef,
}));
const children = await Promise.all(childRequests.map((candidate, index) =>
  gateway.execute(candidate, {
    executionId: `real-chrome-fork:${runId}:child-${index + 1}`,
  })));

for (const [index, child] of children.entries()) {
  assert.equal(
    child.status,
    "success",
    child.failureReason ?? child.reviewRequiredReason ?? "child feed failed",
  );
  assert.equal(child.providerProof.conversationMode, "forked_from_checkpoint");
  const proof = child.providerProof.forkedFromCheckpointProof;
  assert.ok(proof);
  assert.equal(proof.parentConversationUrl, base.providerProof.webChatUrl);
  assert.equal(proof.parentCheckpointResponseHash, base.rawOutputHash);
  assert.notEqual(proof.childConversationUrl, base.providerProof.webChatUrl);
  assert.match(child.rawResponseText ?? "", new RegExp(childTokens[index]!, "u"));
  assert.doesNotMatch(
    child.rawResponseText ?? "",
    new RegExp(childTokens[index === 0 ? 1 : 0], "u"),
  );
}
assert.equal(new Set(children.map(
  (child) => child.providerProof.forkedFromCheckpointProof?.childConversationUrl,
)).size, 2);

export const assertUnsupportedForkFailsClosed = async (): Promise<AiFeedResult> => {
  const invalid = await gateway.execute({
    ...request("invalid-fork", "MUST_NOT_BE_SUBMITTED", `scope:${runId}:invalid`),
    providerForkRef: {
      ...forkRef,
      checkpointResponseHash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      priorRawOutputHash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    },
  }, {
    executionId: `real-chrome-fork:${runId}:invalid`,
  });
  assert.notEqual(invalid.status, "success");
  assert.match(
    invalid.failureReason ?? invalid.reviewRequiredReason ?? "",
    /FORK_CHECKPOINT_RESPONSE_HASH_MISMATCH/iu,
  );
  return invalid;
};

await assertUnsupportedForkFailsClosed();
const firstChild = children[0]!;
const firstChildProof = firstChild.providerProof.forkedFromCheckpointProof!;
const continuationToken = `FORK_FOLLOWUP_${runId.slice(0, 8)}`;
const continuation = await gateway.execute({
  ...request(
    "child-1-followup",
    continuationToken,
    `scope:${runId}:child-1`,
  ),
  providerContinuationRef: {
    priorTaskId: `real-chrome-fork:${runId}:child-1`,
    priorRawOutputHash: firstChild.rawOutputHash!,
    providerPageUrl: firstChildProof.childConversationUrl,
    priorTurnMarker: firstChildProof.childFirstTurnMarker,
  },
}, {
  executionId: `real-chrome-fork:${runId}:child-1-followup`,
});
assert.equal(
  continuation.status,
  "success",
  continuation.failureReason
    ?? continuation.reviewRequiredReason
    ?? "same-conversation followup failed",
);
assert.equal(continuation.providerProof.conversationMode, "same_conversation");
assert.equal(
  continuation.providerProof.webChatUrl,
  firstChildProof.childConversationUrl,
);
assert.match(
  continuation.rawResponseText ?? "",
  new RegExp(continuationToken, "u"),
);
await gateway.close?.();

process.stdout.write(`${JSON.stringify({
  marker: "[ACCEPTANCE][AI-INPUT-GATEWAY][REAL-CHROME-FORK]",
  runRoot,
  parentConversationUrl: base.providerProof.webChatUrl,
  parentCheckpointResponseHash: base.rawOutputHash,
  children: children.map((child) => child.providerProof.forkedFromCheckpointProof),
  continuation: continuation.providerProof.sameConversationProof,
  status: "PASS",
}, null, 2)}\n`);
