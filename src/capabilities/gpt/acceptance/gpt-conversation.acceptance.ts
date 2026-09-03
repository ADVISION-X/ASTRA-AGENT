import { createHash } from "node:crypto";

import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { throwGptChildFailure } from "../production-child-support.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
import {
  exerciseBrowserDispatchedEvidenceReadback,
  exerciseBrowserRejectedEvidenceReadback,
  exerciseFailedEvidenceReadback,
} from "./gpt-failure-evidence-readback.acceptance-support.js";
import {
  coherentObservationPacket,
  exactAssistantTurnReply,
  fakeBrowser,
} from "./gpt-exact-target-browser-fixture.js";

const hash = (value: string | Uint8Array): `sha256:${string}` =>
  `sha256:${createHash("sha256").update(value).digest("hex")}`;
const EMPTY_HASH = hash("");
const conversationUrl = "https://chatgpt.com/c/gpt-browser-handoff";
const childConversationUrl = "https://chatgpt.com/c/gpt-browser-handoff-child";
const marker = "[GRASSEYE:gpt-browser-handoff]";
const prompt = `${marker}\napproved prompt`;
const promptHash = hash(prompt);
const responseText = "approved assistant response";
const responseHash = hash(responseText);
const approvedFile = Object.freeze({
  artifactRef: "artifact:approved",
  displayName: "approved.pdf",
  providerDisplayName: "approved-0123456789ab.pdf",
  sha256: hash("approved-file"),
  bytes: 10,
});

type Fact = Readonly<{
  rawCount: number;
  eligibleCount: number;
  matches?: readonly Readonly<Record<string, unknown>>[];
}>;

const exact = (matches: readonly Readonly<Record<string, unknown>>[] = [{}]): Fact => ({
  rawCount: matches.length,
  eligibleCount: matches.length,
  matches,
});
const absent = (): Fact => ({ rawCount: 0, eligibleCount: 0, matches: [] });

const conversationFacts = (input: Readonly<{
  composerHash?: string;
  promptHash?: string;
  assistant?: boolean;
  attachment?: boolean;
  menuOpen?: boolean;
}> = {}): Readonly<Record<string, Fact>> => ({
  composer: exact([{ semanticTextHash: input.composerHash ?? EMPTY_HASH }]),
  "user-turns": input.promptHash
    ? exact([{ testId: "conversation-turn-1", semanticTextHash: input.promptHash }])
    : absent(),
  "assistant-turns": input.assistant
    ? exact([{ testId: "conversation-turn-2", semanticTextHash: responseHash }])
    : absent(),
  attachments: input.attachment ? exact() : absent(),
  generating: absent(),
  "source-trigger": exact([{ ariaExpanded: input.menuOpen ? "true" : "false" }]),
  "active-menu": input.menuOpen ? exact() : absent(),
  "fork-leaf": input.menuOpen ? exact() : absent(),
});

const responseFacts = (): Readonly<Record<string, Fact>> => ({
  "user-turns": exact([{ testId: "conversation-turn-1", semanticTextHash: promptHash }]),
  "assistant-turns": exact([{ testId: "conversation-turn-2", semanticTextHash: responseHash }]),
  generating: absent(),
  "rate-root": absent(),
  "rate-dialog": absent(),
  "rate-heading": absent(),
  "rate-ack": absent(),
});

const draftFacts = (input: Readonly<{
  composerHash: string;
  submitted?: boolean;
  attachment?: boolean;
}>): Readonly<Record<string, Fact>> => ({
  composer: exact([{ semanticTextHash: input.composerHash }]),
  send: exact([{ tagName: "BUTTON", disabled: false, ariaDisabled: false }]),
  "user-turns": input.submitted
    ? exact([{ testId: "conversation-turn-1", semanticTextHash: promptHash }])
    : absent(),
  "attachment-items": input.attachment
    ? exact([{ ariaLabel: approvedFile.providerDisplayName }])
    : absent(),
});

const sourceInput = Object.freeze({
  sourceAssistantTurnId: "conversation-turn-2",
  sourceCanonicalConversationUrl: conversationUrl,
  sourcePromptHash: promptHash,
  sourceResponseHash: responseHash,
  sourceTurnMarker: marker,
  timeoutMs: 1_000,
});

const freshHarness = () => createGptAcceptanceHarness("gpt-browser-handoff");

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, conversationFacts(), "https://chatgpt.com/");
    }
    throw new Error(`UNEXPECTED_FRESH_CHAT_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "success", result.failureCode ?? "fresh chat proof failed");
  assert.equal(result.value?.staleDraftCleared, false);
  assert.equal(result.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { execute } = freshHarness();
  let cleared = false;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, conversationFacts({
        composerHash: cleared ? EMPTY_HASH : hash("stale draft"),
      }), "https://chatgpt.com/");
    }
    if (intent.kind === "fill") {
      assert.equal(intent.approvedText, "");
      cleared = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_CLEAN_CHAT_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "success", result.failureCode ?? "stale draft clear failed");
  assert.equal(result.value?.staleDraftCleared, true);
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(fixture.physicalMutations(), 1);
}

{
  const { execute } = freshHarness();
  let reads = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      reads += 1;
      return coherentObservationPacket(intent, conversationFacts({
        composerHash: reads === 1 ? hash("stale draft") : EMPTY_HASH,
      }), "https://chatgpt.com/");
    }
    if (intent.kind === "fill") {
      return { mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true };
    }
    throw new Error(`UNEXPECTED_ZERO_ACTION_CLEAN_CHAT_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "success", result.failureCode ?? "zero-action stale draft reconciliation failed");
  assert.equal(result.value?.staleDraftCleared, false);
  assert.equal(result.proof.committedMutation, "no");
  assert.equal(result.proof.browserFact?.browserOutcome, "CONFIRMED");
  assert.equal(result.proof.browserFact?.mutationOutcome, "no");
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { execute } = freshHarness();
  let reads = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      reads += 1;
      return coherentObservationPacket(intent, conversationFacts({
        composerHash: reads === 1 ? hash("stale draft") : EMPTY_HASH,
        attachment: reads > 1,
      }), "https://chatgpt.com/");
    }
    if (intent.kind === "fill") {
      return { mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true };
    }
    throw new Error(`UNEXPECTED_FAILED_CLEAN_CHAT_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_CHAT_DRAFT_CLEAR_FAILED");
  assert.equal(result.failureCause?.code, "GPT_CHAT_ATTACHMENT_PRESENT");
  assert.equal(result.proof.committedMutation, "no");
  assert.equal(result.proof.browserFact?.browserOutcome, "CONFIRMED");
  assert.equal(result.proof.browserFact?.mutationOutcome, "no");
  assert.equal(result.proof.browserFact?.evidenceRef, "browser-mutation:acceptance-call");
  assert.equal(result.proof.candidateCardinality.raw, 1);
  assert.equal(fixture.physicalMutations(), 0);
  let serialized: ReturnType<typeof serializeTerminalFailure> | null = null;
  try { throwGptChildFailure(result); }
  catch (error) { serialized = serializeTerminalFailure(error); }
  assert.deepEqual(serialized, {
    code: "GPT_CHAT_DRAFT_CLEAR_FAILED",
    mutation_outcome: "no",
    effect_scope: "target_local",
    child_capability_id: "prepare_clean_gpt_chat",
    browser_outcome: "CONFIRMED",
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
    cause: { name: "Error", code: "GPT_CHAT_ATTACHMENT_PRESENT" },
  });
  await exerciseFailedEvidenceReadback(result, serialized!);
}

await exerciseBrowserRejectedEvidenceReadback();
await exerciseBrowserDispatchedEvidenceReadback();

{
  const { execute } = freshHarness();
  let reads = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      reads += 1;
      return coherentObservationPacket(intent, conversationFacts({
        composerHash: reads === 1 ? hash("stale draft") : EMPTY_HASH,
        assistant: reads > 1,
      }), "https://chatgpt.com/");
    }
    if (intent.kind === "fill") {
      return { mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true };
    }
    throw new Error(`UNEXPECTED_ASSISTANT_RESIDUE_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCause?.code, "GPT_CHAT_PRIOR_ASSISTANT_TURN_PRESENT");
}

{
  const { execute } = freshHarness();
  let reads = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      reads += 1;
      return coherentObservationPacket(intent, conversationFacts(), reads === 1 ? "https://chatgpt.com/" : conversationUrl);
    }
    throw new Error(`UNEXPECTED_FOCUS_INTENT:${intent.kind}`);
  });
  const result = await execute("focus_exact_gpt_conversation", fixture.browser, {
    canonicalConversationUrl: conversationUrl,
  });
  assert.equal(result.status, "success", result.failureCode ?? "exact conversation focus failed");
  assert.equal(result.value?.url, conversationUrl);
  assert.equal(fixture.physicalMutations(), 1);
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, conversationFacts({ promptHash, assistant: true }), conversationUrl);
    }
    if (intent.kind === "readExactAssistantTurn") {
      return exactAssistantTurnReply(intent.assistantTurnId, responseText);
    }
    throw new Error(`UNEXPECTED_IDENTITY_INTENT:${intent.kind}`);
  });
  const result = await execute("verify_gpt_conversation_identity", fixture.browser, {
    canonicalConversationUrl: conversationUrl,
    expectedPromptHash: promptHash,
    expectedResponseHash: responseHash,
    timeoutMs: 1_000,
    turnMarker: marker,
  });
  assert.equal(result.status, "success", result.failureCode ?? "conversation identity proof failed");
  assert.equal(result.value?.canonicalConversationUrl, conversationUrl);
  assert.equal(result.value?.semanticText, responseText);
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { execute } = freshHarness();
  let menuOpen = false;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, conversationFacts({ promptHash, assistant: true, menuOpen }), conversationUrl);
    }
    if (intent.kind === "readExactAssistantTurn") {
      return exactAssistantTurnReply(intent.assistantTurnId, responseText);
    }
    if (intent.kind === "click") {
      menuOpen = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_MENU_INTENT:${intent.kind}`);
  });
  const result = await execute("open_gpt_checkpoint_actions_menu", fixture.browser, sourceInput);
  assert.equal(result.status, "success", result.failureCode ?? "checkpoint menu open failed");
  assert.equal(result.value?.state, "opened");
  assert.equal(fixture.physicalMutations(), 1);
}

{
  const { execute } = freshHarness();
  let forked = false;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, conversationFacts({
        promptHash,
        assistant: true,
        menuOpen: !forked,
      }), forked ? childConversationUrl : conversationUrl);
    }
    if (intent.kind === "readExactAssistantTurn") {
      return exactAssistantTurnReply(intent.assistantTurnId, responseText);
    }
    if (intent.kind === "click") {
      forked = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_FORK_INTENT:${intent.kind}`);
  });
  const result = await execute("fork_exact_gpt_conversation_at_checkpoint", fixture.browser, sourceInput);
  assert.equal(result.status, "success", result.failureCode ?? "checkpoint fork failed");
  assert.equal(result.value?.childCanonicalConversationUrl, childConversationUrl);
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(fixture.physicalMutations(), 1);
}

{
  const { execute } = freshHarness();
  let currentHash = EMPTY_HASH;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, draftFacts({ composerHash: currentHash }), "https://chatgpt.com/");
    }
    if (intent.kind === "fill") {
      assert.equal(intent.approvedText, prompt);
      currentHash = promptHash;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_PROMPT_INTENT:${intent.kind}`);
  });
  const result = await execute("write_exact_gpt_prompt", fixture.browser, { prompt });
  assert.equal(result.status, "success", result.failureCode ?? "prompt write failed");
  assert.equal(result.value?.hash, promptHash);
  assert.equal(fixture.physicalMutations(), 1);
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, draftFacts({ composerHash: promptHash, attachment: true }));
    }
    throw new Error(`UNEXPECTED_DRAFT_INTENT:${intent.kind}`);
  });
  const result = await execute("reconcile_gpt_draft", fixture.browser, {
    files: [approvedFile], prompt, turnMarker: marker,
  });
  assert.equal(result.status, "success", result.failureCode ?? "draft reconciliation failed");
  assert.deepEqual(result.value?.attachmentDisplayNames, [approvedFile.providerDisplayName]);
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { execute } = freshHarness();
  let submitted = false;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, draftFacts({
        composerHash: submitted ? EMPTY_HASH : promptHash,
        submitted,
      }), submitted ? conversationUrl : "https://chatgpt.com/");
    }
    if (intent.kind === "click") {
      submitted = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_SUBMIT_INTENT:${intent.kind}`);
  });
  const submittedResult = await execute("submit_exact_gpt_turn_once", fixture.browser, {
    files: [approvedFile], promptHash, turnMarker: marker,
  });
  assert.equal(submittedResult.status, "success", submittedResult.failureCode ?? "turn submission failed");
  assert.equal(submittedResult.value?.mutationSent, true);
  assert.equal(submittedResult.proof.committedMutation, "confirmed");
  assert.equal(fixture.physicalMutations(), 1);

  const reconciled = await execute("reconcile_gpt_turn_submission", fixture.browser, {
    expectedPromptHash: promptHash, timeoutMs: 1_000, turnMarker: marker,
  });
  assert.equal(reconciled.status, "success", reconciled.failureCode ?? "submission reconciliation failed");
  assert.equal(reconciled.value?.canonicalConversationUrl, conversationUrl);
  assert.equal(fixture.physicalMutations(), 1, "readback must not submit again");
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, responseFacts(), conversationUrl);
    if (intent.kind === "readExactAssistantTurn") {
      return exactAssistantTurnReply(intent.assistantTurnId, responseText);
    }
    throw new Error(`UNEXPECTED_TEXT_RESPONSE_INTENT:${intent.kind}`);
  });
  const waited = await execute("wait_for_stable_gpt_text", fixture.browser, {
    absoluteDeadline: new Date(Date.now() - 1).toISOString(),
    canonicalConversationUrl: conversationUrl,
    expectedPromptHash: promptHash,
    turnMarker: marker,
  });
  assert.equal(waited.status, "success", waited.failureCode ?? "stable text wait failed");
  assert.equal(waited.value?.responseText, responseText);
  const checkpoint = await execute("checkpoint_gpt_text_response", fixture.browser, {
    assistantTurnId: "conversation-turn-2",
    canonicalConversationUrl: conversationUrl,
    expectedPromptHash: promptHash,
    expectedResponseHash: responseHash,
    turnMarker: marker,
  });
  assert.equal(checkpoint.status, "success", checkpoint.failureCode ?? "text checkpoint failed");
  assert.equal(checkpoint.value?.semanticTextHash, responseHash);
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { execute } = freshHarness();
  const original = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>',
  );
  const mediaHash = hash(original);
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, responseFacts(), conversationUrl);
    throw new Error(`UNEXPECTED_IMAGE_RESPONSE_INTENT:${intent.kind}`);
  }, { authenticatedMedia: {
    authorityTargetHash: `sha256:${"2".repeat(64)}`,
    authorityDocumentHash: `sha256:${"3".repeat(64)}`,
    assistantTurnId: "conversation-turn-2",
    semanticMediaId: "gpt-generated-image-main",
    bytesBase64: original.toString("base64"),
    sha256: mediaHash,
    sizeBytes: original.byteLength,
    mediaType: "image/svg+xml",
    width: 16,
    height: 16,
  } });
  const waited = await execute("wait_for_stable_gpt_image", fixture.browser, {
    absoluteDeadline: new Date(Date.now() - 1).toISOString(),
    canonicalConversationUrl: conversationUrl,
    expectedPromptHash: promptHash,
    turnMarker: marker,
  });
  assert.equal(waited.status, "success", waited.failureCode ?? "stable image wait failed");
  assert.equal(waited.value?.mediaHash, mediaHash);
  const checkpoint = await execute("checkpoint_gpt_generated_image", fixture.browser, {
    assistantTurnId: "conversation-turn-2",
    canonicalConversationUrl: conversationUrl,
    expectedMediaHash: mediaHash,
    expectedPromptHash: promptHash,
    predecessorTextCheckpoint: {
      checkpointKind: "text",
      sourceAttemptId: "attempt:source",
      assistantTurnId: "conversation-turn-2",
      artifactRef: "artifact:text",
      rawDomHash: hash("raw-dom"),
      semanticTextHash: responseHash,
      canonicalConversationUrl: conversationUrl,
      promptHash,
      turnMarker: marker,
      evidenceRef: "evidence:text",
      evidenceHash: hash("evidence"),
    },
    turnMarker: marker,
  });
  assert.equal(checkpoint.status, "success", checkpoint.failureCode ?? "image checkpoint failed");
  assert.equal(checkpoint.value?.mediaType, "image/webp");
  assert.equal(checkpoint.value?.width, 1200);
  assert.equal(checkpoint.value?.height, 630);
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { execute } = freshHarness();
  const invalidFixture = fakeBrowser(() => { throw new Error("INVALID_INPUT_MUST_NOT_TOUCH_BROWSER"); });
  const missingInput = await execute("verify_gpt_conversation_identity", invalidFixture.browser, {} as never);
  assert.equal(missingInput.status, "failed");
  assert.match(missingInput.failureCode ?? "", /^GPT_CHILD_INPUT_INVALID:verify_gpt_conversation_identity:/u);
  const extraInput = await execute("write_exact_gpt_prompt", invalidFixture.browser, {
    prompt: "approved", extra: true,
  } as never);
  assert.equal(extraInput.status, "failed");
  assert.match(extraInput.failureCode ?? "", /^GPT_CHILD_INPUT_INVALID:write_exact_gpt_prompt:/u);
  assert.equal(invalidFixture.documentCalls(), 0);
  assert.equal(invalidFixture.physicalMutations(), 0);
}
