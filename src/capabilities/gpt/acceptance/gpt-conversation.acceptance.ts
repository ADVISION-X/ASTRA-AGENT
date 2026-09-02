import assert from "../../../../scripts/audit/shared/governance-exam-assert.js";

import type { GptChildCapabilityId, GptChildInputMap } from "../index.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

const { execute } = createGptAcceptanceHarness("gpt-browser-handoff");
const HASH_A = `sha256:${"a".repeat(64)}` as const;
const HASH_B = `sha256:${"b".repeat(64)}` as const;
const HASH_C = `sha256:${"c".repeat(64)}` as const;
const conversationUrl = "https://chatgpt.com/c/gpt-browser-handoff";
const marker = "[GRASSEYE:gpt-browser-handoff]";
const approvedFile = Object.freeze({
  artifactRef: "artifact:approved",
  displayName: "approved.pdf",
  providerDisplayName: "approved-0123456789ab.pdf",
  sha256: HASH_A,
  bytes: 10,
});
const predecessorTextCheckpoint = Object.freeze({
  checkpointKind: "text" as const,
  sourceAttemptId: "attempt:source",
  assistantTurnId: "conversation-turn-2",
  artifactRef: "artifact:text",
  rawDomHash: HASH_A,
  semanticTextHash: HASH_B,
  canonicalConversationUrl: conversationUrl,
  promptHash: HASH_C,
  turnMarker: marker,
  evidenceRef: "evidence:text",
  evidenceHash: HASH_A,
});

const assertBlocked = async <K extends GptChildCapabilityId>(
  childCapabilityId: K,
  input: GptChildInputMap[K],
  expectedCode: string,
): Promise<void> => {
  const fixture = fakeBrowser(() => {
    throw new Error(`BLOCKED_CHILD_MUST_NOT_TOUCH_BROWSER:${childCapabilityId}`);
  });
  const result = await execute(childCapabilityId, fixture.browser, input);
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, expectedCode);
  assert.equal(result.proof.internalDecisionCode, "FAIL_CLOSED");
  assert.equal(result.proof.committedMutation, "no");
  assert.equal(result.proof.observationRevisionHash, null);
  assert.equal(fixture.documentCalls(), 0, `${childCapabilityId} must perform zero DOM calls while blocked`);
  assert.equal(fixture.physicalMutations(), 0, `${childCapabilityId} must perform zero physical mutations while blocked`);
  assert.equal(fixture.authenticatedMediaDownloads(), 0,
    `${childCapabilityId} must not download media before the coherent identity handoff exists`);
};

const PAGE_BLOCK = "GPT_BROWSER_COHERENT_PAGE_HANDOFF_REQUIRED";
await assertBlocked("prepare_clean_gpt_chat", { timeoutMs: 1_000 }, PAGE_BLOCK);
await assertBlocked("focus_exact_gpt_conversation", { canonicalConversationUrl: conversationUrl }, PAGE_BLOCK);
await assertBlocked("verify_gpt_conversation_identity", {
  canonicalConversationUrl: conversationUrl,
  expectedPromptHash: HASH_A,
  expectedResponseHash: HASH_B,
  timeoutMs: 1_000,
  turnMarker: marker,
}, PAGE_BLOCK);
await assertBlocked("open_gpt_checkpoint_actions_menu", {
  sourceAssistantTurnId: "conversation-turn-2",
  sourceCanonicalConversationUrl: conversationUrl,
  sourcePromptHash: HASH_A,
  sourceResponseHash: HASH_B,
  sourceTurnMarker: marker,
  timeoutMs: 1_000,
}, PAGE_BLOCK);
await assertBlocked("fork_exact_gpt_conversation_at_checkpoint", {
  sourceAssistantTurnId: "conversation-turn-2",
  sourceCanonicalConversationUrl: conversationUrl,
  sourcePromptHash: HASH_A,
  sourceResponseHash: HASH_B,
  sourceTurnMarker: marker,
  timeoutMs: 1_000,
}, PAGE_BLOCK);
await assertBlocked("write_exact_gpt_prompt", { prompt: `${marker}\napproved prompt` }, PAGE_BLOCK);
await assertBlocked("reconcile_gpt_draft", {
  files: [approvedFile], prompt: `${marker}\napproved prompt`, turnMarker: marker,
}, PAGE_BLOCK);
await assertBlocked("submit_exact_gpt_turn_once", {
  files: [approvedFile], promptHash: HASH_A, turnMarker: marker,
}, PAGE_BLOCK);
await assertBlocked("reconcile_gpt_turn_submission", {
  expectedPromptHash: HASH_A, timeoutMs: 1_000, turnMarker: marker,
}, PAGE_BLOCK);

const SEMANTIC_BLOCK = "GPT_BROWSER_COHERENT_SEMANTIC_HANDOFF_REQUIRED";
await assertBlocked("wait_for_stable_gpt_text", {
  absoluteDeadline: new Date(Date.now() - 1).toISOString(),
  canonicalConversationUrl: conversationUrl,
  expectedPromptHash: HASH_A,
  turnMarker: marker,
}, SEMANTIC_BLOCK);
await assertBlocked("checkpoint_gpt_text_response", {
  assistantTurnId: "conversation-turn-2",
  canonicalConversationUrl: conversationUrl,
  expectedPromptHash: HASH_A,
  expectedResponseHash: HASH_B,
  turnMarker: marker,
}, SEMANTIC_BLOCK);
await assertBlocked("wait_for_stable_gpt_image", {
  absoluteDeadline: new Date(Date.now() - 1).toISOString(),
  canonicalConversationUrl: conversationUrl,
  expectedPromptHash: HASH_A,
  turnMarker: marker,
}, SEMANTIC_BLOCK);
await assertBlocked("checkpoint_gpt_generated_image", {
  assistantTurnId: "conversation-turn-2",
  canonicalConversationUrl: conversationUrl,
  expectedMediaHash: HASH_B,
  expectedPromptHash: HASH_A,
  predecessorTextCheckpoint,
  turnMarker: marker,
}, SEMANTIC_BLOCK);

const invalidFixture = fakeBrowser(() => { throw new Error("INVALID_INPUT_MUST_NOT_TOUCH_BROWSER"); });
const missingInput = await execute("verify_gpt_conversation_identity", invalidFixture.browser, {} as never);
assert.equal(missingInput.status, "failed");
assert.match(missingInput.failureCode ?? "", /^GPT_CHILD_INPUT_INVALID:verify_gpt_conversation_identity:/u);
const extraInput = await execute("write_exact_gpt_prompt", invalidFixture.browser, {
  prompt: "approved", extra: true,
} as never);
assert.equal(extraInput.status, "failed");
assert.match(extraInput.failureCode ?? "", /^GPT_CHILD_INPUT_INVALID:write_exact_gpt_prompt:/u);
const wrongType = await execute("reconcile_gpt_turn_submission", invalidFixture.browser, {
  expectedPromptHash: HASH_A, timeoutMs: "1000", turnMarker: marker,
} as never);
assert.equal(wrongType.status, "failed");
assert.equal(wrongType.failureCode,
  "GPT_CHILD_INPUT_INVALID:reconcile_gpt_turn_submission:timeoutMs");
assert.equal(invalidFixture.documentCalls(), 0);
assert.equal(invalidFixture.physicalMutations(), 0);

const stableInput = Object.freeze({
  canonicalConversationUrl: conversationUrl,
  expectedPromptHash: HASH_A,
  expectedResponseHash: HASH_B,
  timeoutMs: 1_000,
  turnMarker: marker,
});
const stableFixture = () => fakeBrowser(() => { throw new Error("BLOCKED_CHILD_MUST_NOT_TOUCH_BROWSER"); });
const stableOne = await createGptAcceptanceHarness("gpt-blocker-stability")
  .execute("verify_gpt_conversation_identity", stableFixture().browser, stableInput);
const stableTwo = await createGptAcceptanceHarness("gpt-blocker-stability")
  .execute("verify_gpt_conversation_identity", stableFixture().browser, stableInput);
assert.equal(stableOne.proof.evidenceHash, stableTwo.proof.evidenceHash,
  "same blocked exact call must produce one stable proof hash without sensitive inputs");
assert.equal(JSON.stringify(stableOne.proof).includes(marker), false);
