import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  createGptAbilityGroup,
  type GptAbilityGroup,
  type GptChildCapabilityId,
} from "../index.js";
import type { BrowserTargetLease } from "../../../lib/browser/browser-authority-api.js";
import { hashCanonical } from "../../../lib/local-runtime/production/contracts.js";
import { GPT_COMPOSER_SELECTOR } from "../web/contracts/composer.contract.js";
import {
  GPT_GENERATING_STOP_SELECTOR,
  GPT_USER_PROMPT_BODY_SELECTOR,
  GPT_USER_TURN_SELECTOR,
} from "../web/contracts/conversation.contract.js";
import { GPT_SEND_SELECTOR } from "../web/contracts/submission.contract.js";
import { fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

const gpt = createGptAbilityGroup();
type GptExecutionContext = Parameters<GptAbilityGroup["execute"]>[1];

let ordinal = 0;
const execute = (
  childCapabilityId: GptChildCapabilityId,
  browser: BrowserTargetLease,
  input: Readonly<Record<string, unknown>>,
  mutationMode?: "normal" | "readback",
  contextOverrides?: Partial<GptExecutionContext>,
) => {
  ordinal += 1;
  return gpt.execute({
    childCapabilityId,
    executionId: `acceptance:conversation:${childCapabilityId}:${ordinal}`,
    jobId: "job:gpt-exact-target",
    attemptId: "attempt:gpt-exact-target",
    pluginId: "acceptance-product",
    pluginVersion: 1,
    productStepId: "acceptance-conversation",
    callId: "acceptance-call",
    inputHash: hashCanonical(input),
    actionOrdinal: ordinal,
    input,
  }, {
    dataDir: "/tmp/gpt-exact-target",
    browser,
    ...(mutationMode ? { mutationMode } : {}),
    ...contextOverrides,
  });
};

const promptMarker = `[GRASSEYE:${"a".repeat(24)}]`;
const prompt = `approved prompt\n${promptMarker}`;
const promptHash = `sha256:${createHash("sha256").update(prompt).digest("hex")}`;
const canonicalConversationUrl = "https://chatgpt.com/c/gpt-exact-target";
const promptBodySelector =
  `[data-testid="conversation-turn-1"][data-turn='user'] [data-message-author-role='user'] ${GPT_USER_PROMPT_BODY_SELECTOR}`;
const clearedPromptFixture = fakeBrowser((intent) => {
  if (intent.kind === "find" && intent.selector === GPT_USER_TURN_SELECTOR) return { count: 0 };
  if (intent.kind === "readText" && intent.selector === GPT_COMPOSER_SELECTOR) return "";
  throw new Error(`UNEXPECTED_CLEARED_PROMPT_INTENT:${intent.kind}`);
});
const clearedBeforeSubmit = await execute("submit_exact_gpt_turn_once", clearedPromptFixture.browser, {
  promptHash, turnMarker: promptMarker,
});
assert.equal(clearedBeforeSubmit.status, "failed");
assert.equal(clearedBeforeSubmit.failureCode, "GPT_PROMPT_CHANGED_BEFORE_SUBMIT");
assert.equal(clearedPromptFixture.physicalMutations(), 0, "cleared prompt must never reach send dispatch");

const retainedPromptFixture = fakeBrowser((intent) => {
  if (intent.kind === "find" && intent.selector === GPT_USER_TURN_SELECTOR) return { count: 0 };
  if (intent.kind === "readText" && intent.selector === GPT_COMPOSER_SELECTOR) return prompt;
  if (intent.kind === "find" && intent.selector === GPT_SEND_SELECTOR) return { count: 1 };
  if (intent.kind === "inspect" && intent.selector === GPT_SEND_SELECTOR) {
    return { tagName: "BUTTON", visible: true, disabled: false };
  }
  if (intent.kind === "click" && intent.selector === GPT_SEND_SELECTOR) return { postconditionVerified: true };
  throw new Error(`UNEXPECTED_RETAINED_PROMPT_INTENT:${intent.kind}`);
});
const retainedBeforeSubmit = await execute("submit_exact_gpt_turn_once", retainedPromptFixture.browser, {
  promptHash, turnMarker: promptMarker,
});
assert.equal(retainedBeforeSubmit.status, "success", retainedBeforeSubmit.failureCode ?? "retained prompt submit failed");
assert.equal(retainedPromptFixture.physicalMutations(), 1, "retained exact prompt may dispatch send exactly once");

const assistantText = '{"schema_version":"public-knowledge-research-output.v3"}';
const assistantHash = `sha256:${createHash("sha256").update(assistantText).digest("hex")}`;
const assistantCheckpointFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return { url: canonicalConversationUrl, title: "ChatGPT" };
  if (intent.kind === "find" && intent.selector === GPT_USER_TURN_SELECTOR) return { count: 1 };
  if (intent.kind === "readAttribute" && intent.selector === GPT_USER_TURN_SELECTOR) return "conversation-turn-1";
  if (intent.kind === "readText" && intent.selector === promptBodySelector) {
    return prompt;
  }
  if (intent.kind === "inspect") {
    assert.equal(
      intent.selector,
      `[data-testid="conversation-turn-2"][data-turn='assistant'] [data-message-author-role='assistant']`,
    );
    return {
      outerHtml: `<div data-message-author-role="assistant">${assistantText}</div>`,
      semanticText: assistantText,
      visible: true,
      connected: true,
    };
  }
  throw new Error(`UNEXPECTED_ASSISTANT_CHECKPOINT_INTENT:${intent.kind}`);
});
const assistantCheckpoint = await execute(
  "checkpoint_gpt_text_response",
  assistantCheckpointFixture.browser,
  {
    assistantTurnId: "conversation-turn-2", canonicalConversationUrl,
    expectedPromptHash: promptHash, expectedResponseHash: assistantHash, turnMarker: promptMarker,
  },
);
assert.equal(assistantCheckpoint.status, "success", assistantCheckpoint.failureCode ?? "assistant checkpoint failed");
assert.equal(
  (assistantCheckpoint.value as Readonly<Record<string, unknown>>).semanticText,
  assistantText,
  "checkpoint must read only the assistant message body, excluding turn headings and action controls",
);

const continuationIdentityFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return { url: canonicalConversationUrl, title: "ChatGPT" };
  if (intent.kind === "find" && intent.selector === GPT_COMPOSER_SELECTOR) return { count: 1 };
  if (intent.kind === "find" && intent.selector === GPT_USER_TURN_SELECTOR) return { count: 1 };
  if (intent.kind === "readAttribute" && intent.selector === GPT_USER_TURN_SELECTOR) {
    return "conversation-turn-1";
  }
  if (intent.kind === "readText" && intent.selector === promptBodySelector) return prompt;
  if (intent.kind === "find"
    && intent.selector === `[data-testid="conversation-turn-2"][data-turn='assistant'] [data-message-author-role='assistant']`) {
    return { count: 1 };
  }
  if (intent.kind === "inspect") return { semanticText: assistantText, visible: true, connected: true };
  throw new Error(`UNEXPECTED_CONTINUATION_IDENTITY_INTENT:${intent.kind}`);
}, { initialUrl: canonicalConversationUrl });
const continuationIdentity = await execute(
  "verify_gpt_conversation_identity",
  continuationIdentityFixture.browser,
  {
    canonicalConversationUrl,
    expectedPromptHash: promptHash,
    expectedResponseHash: assistantHash,
    timeoutMs: 1_000,
    turnMarker: promptMarker,
  },
);
assert.equal(continuationIdentity.status, "success", continuationIdentity.failureCode ?? "continuation identity failed");
const continuationPromptDrift = await execute(
  "verify_gpt_conversation_identity",
  continuationIdentityFixture.browser,
  {
    canonicalConversationUrl,
    expectedPromptHash: `sha256:${"f".repeat(64)}`,
    expectedResponseHash: assistantHash,
    timeoutMs: 1_000,
    turnMarker: promptMarker,
  },
);
assert.equal(continuationPromptDrift.status, "failed");
assert.equal(continuationPromptDrift.failureCode, "GPT_USER_TURN_HASH_MISMATCH");

const nonAdjacentAssistant = await execute(
  "checkpoint_gpt_text_response",
  assistantCheckpointFixture.browser,
  {
    assistantTurnId: "conversation-turn-3", canonicalConversationUrl,
    expectedPromptHash: promptHash, expectedResponseHash: assistantHash, turnMarker: promptMarker,
  },
);
assert.equal(nonAdjacentAssistant.status, "failed");
assert.equal(nonAdjacentAssistant.failureCode, "GPT_RESPONSE_CHECKPOINT_MISMATCH");

const responseHashDrift = await execute(
  "checkpoint_gpt_text_response",
  assistantCheckpointFixture.browser,
  {
    assistantTurnId: "conversation-turn-2", canonicalConversationUrl,
    expectedPromptHash: promptHash, expectedResponseHash: `sha256:${"f".repeat(64)}`,
    turnMarker: promptMarker,
  },
);
assert.equal(responseHashDrift.status, "failed");
assert.equal(responseHashDrift.failureCode, "GPT_RESPONSE_CHECKPOINT_MISMATCH");

let driftDocumentReads = 0;
const urlDriftFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") {
    driftDocumentReads += 1;
    return {
      url: driftDocumentReads === 1 ? "https://chatgpt.com/" : canonicalConversationUrl,
      title: "ChatGPT",
    };
  }
  if (intent.kind === "find" && intent.selector === GPT_USER_TURN_SELECTOR) return { count: 1 };
  if (intent.kind === "readAttribute" && intent.selector === GPT_USER_TURN_SELECTOR) {
    return "conversation-turn-1";
  }
  if (intent.kind === "readText" && intent.selector === promptBodySelector) {
    return prompt;
  }
  if (intent.kind === "find"
    && intent.selector === `[data-testid="conversation-turn-2"][data-turn='assistant'] [data-message-author-role='assistant']`) {
    return { count: 1 };
  }
  if (intent.kind === "inspect") return { semanticText: assistantText, visible: true, connected: true };
  if (intent.kind === "find" && intent.selector === GPT_GENERATING_STOP_SELECTOR) return { count: 0 };
  throw new Error(`UNEXPECTED_URL_DRIFT_INTENT:${intent.kind}`);
}, { initialUrl: "https://chatgpt.com/" });
const urlDriftRecovered = await execute("wait_for_stable_gpt_text", urlDriftFixture.browser, {
  absoluteDeadline: new Date(Date.now() - 60_000).toISOString(),
  canonicalConversationUrl,
  expectedPromptHash: promptHash,
  turnMarker: promptMarker,
});
assert.equal(urlDriftRecovered.status, "success", urlDriftRecovered.failureCode ?? "URL drift recovery failed");
assert.equal(urlDriftFixture.physicalMutations(), 1,
  "polling URL drift must navigate the same exact Target once and never create or guess another Tab");
assert.deepEqual(urlDriftFixture.waitDurations(), [250],
  "URL recovery uses one bounded hydration wait before URL + hash readback");

const wrongPromptHashFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return { url: canonicalConversationUrl, title: "ChatGPT" };
  if (intent.kind === "find" && intent.selector === GPT_USER_TURN_SELECTOR) return { count: 1 };
  if (intent.kind === "readAttribute" && intent.selector === GPT_USER_TURN_SELECTOR) {
    return "conversation-turn-1";
  }
  if (intent.kind === "readText" && intent.selector === promptBodySelector) {
    return `${prompt}\nprovider-mutated`;
  }
  throw new Error(`UNEXPECTED_WRONG_PROMPT_HASH_INTENT:${intent.kind}`);
});
const wrongPromptHash = await execute("wait_for_stable_gpt_text", wrongPromptHashFixture.browser, {
  absoluteDeadline: new Date(Date.now() - 60_000).toISOString(),
  canonicalConversationUrl,
  expectedPromptHash: promptHash,
  turnMarker: promptMarker,
});
assert.equal(wrongPromptHash.status, "failed");
assert.equal(wrongPromptHash.failureCode, "GPT_USER_TURN_HASH_MISMATCH");
assert.equal(wrongPromptHashFixture.physicalMutations(), 0,
  "matching URL and marker must never accept a different prompt hash");

const providerWaitFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return { url: canonicalConversationUrl, title: "ChatGPT" };
  if (intent.kind === "find" && intent.selector === GPT_USER_TURN_SELECTOR) return { count: 0 };
  throw new Error(`UNEXPECTED_PROVIDER_WAIT_INTENT:${intent.kind}`);
});
const yielded: number[] = [];
const providerWaitDeadline = new Date(Date.now() + 75).toISOString();
const providerWaitResult = await execute("wait_for_stable_gpt_text", providerWaitFixture.browser, {
  absoluteDeadline: providerWaitDeadline,
  canonicalConversationUrl,
  expectedPromptHash: promptHash,
  turnMarker: promptMarker,
}, undefined, {
  yieldForProviderWait: async (durationMs) => {
    yielded.push(durationMs);
    await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
  },
});
assert.equal(providerWaitResult.status, "failed");
assert.equal(providerWaitResult.failureCode, "GPT_RESPONSE_STABILITY_TIMEOUT");
assert.equal(yielded.length >= 1, true, "Provider wait must cooperatively yield its Browser lane");
assert.equal(yielded.every((duration) => duration >= 25 && duration <= 5_000), true);
assert.deepEqual(providerWaitFixture.waitDurations(), [], "cooperative Provider wait must not hold Browser.wait");

const overdueTextFixture = fakeBrowser((intent) => {
  if (intent.kind === "document") return { url: canonicalConversationUrl, title: "ChatGPT" };
  if (intent.kind === "find" && intent.selector === GPT_USER_TURN_SELECTOR) return { count: 1 };
  if (intent.kind === "readAttribute" && intent.selector === GPT_USER_TURN_SELECTOR) {
    assert.equal(intent.textContains, promptMarker,
      "the exact turn marker must scope user-turn identity in a multi-turn conversation");
    return "conversation-turn-1";
  }
  if (intent.kind === "readText" && intent.selector === promptBodySelector) {
    return prompt;
  }
  if (intent.kind === "find"
    && intent.selector === `[data-testid="conversation-turn-2"][data-turn='assistant'] [data-message-author-role='assistant']`) {
    return { count: 1 };
  }
  if (intent.kind === "inspect") return { semanticText: assistantText, visible: true, connected: true };
  if (intent.kind === "find" && intent.selector === GPT_GENERATING_STOP_SELECTOR) return { count: 0 };
  throw new Error(`UNEXPECTED_OVERDUE_TEXT_INTENT:${intent.kind}`);
});
const overdueText = await execute("wait_for_stable_gpt_text", overdueTextFixture.browser, {
  absoluteDeadline: new Date(Date.now() - 60_000).toISOString(),
  canonicalConversationUrl,
  expectedPromptHash: promptHash,
  turnMarker: promptMarker,
});
assert.equal(overdueText.status, "success", overdueText.failureCode ?? "overdue text readback failed");
assert.equal(
  (overdueText.value as Readonly<Record<string, unknown>>).responseHash,
  assistantHash,
  "an overdue confirmed Provider turn must read back its terminal response without replaying submit",
);
assert.equal(overdueTextFixture.physicalMutations(), 0);
assert.deepEqual(overdueTextFixture.waitDurations(), []);

const invalidDeadline = await execute("wait_for_stable_gpt_text", providerWaitFixture.browser, {
  absoluteDeadline: new Date(Date.now() + 3_700_000).toISOString(),
  canonicalConversationUrl,
  expectedPromptHash: promptHash,
  turnMarker: promptMarker,
});
assert.equal(invalidDeadline.status, "failed");
assert.equal(invalidDeadline.failureCode, "GPT_RESPONSE_ABSOLUTE_DEADLINE_INVALID");


