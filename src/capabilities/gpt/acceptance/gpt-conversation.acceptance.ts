import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { throwGptChildFailure } from "../production-child-support.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
import {
  exerciseBrowserDispatchedEvidenceReadback,
  exerciseBrowserRejectedDispatchedEvidenceReadback,
  exerciseBrowserRejectedEvidenceReadback,
  exerciseFailedEvidenceReadback,
} from "./gpt-failure-evidence-readback.acceptance-support.js";
import {
  coherentObservationPacket,
  exactAssistantTurnReply,
  fakeBrowser,
} from "./gpt-exact-target-browser-fixture.js";
import {
  EMPTY_HASH,
  approvedFile,
  childConversationUrl,
  conversationFacts,
  conversationUrl,
  freshHarness,
  hash,
  marker,
  promptHash,
  responseFacts,
  responseHash,
  responseText,
  sourceInput,
} from "./gpt-conversation-fixture.js";
import {
  GPT_MORE_ACTIONS_BUTTON_LABEL,
  gptMoreActionsButtonSelector,
} from "./gpt-page-fixture-selectors.js";
import "./gpt-turn-submission.acceptance.js";

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
  let simulatedNow = 0;
  let reads = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      reads += 1;
      return coherentObservationPacket(intent, conversationFacts({
        composerHash: reads < 4 ? hash("stale draft") : EMPTY_HASH,
      }), "https://chatgpt.com/");
    }
    if (intent.kind === "fill") return { postconditionVerified: true };
    throw new Error(`UNEXPECTED_SETTLING_CLEAN_CHAT_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 1_000 });
    assert.equal(result.status, "success", result.failureCode ?? "settled stale draft clear failed");
    assert.equal(simulatedNow, 250,
      "draft clear must consume fresh observations and stop before the 2500ms ceiling");
    assert.equal(fixture.physicalMutations(), 1, "draft clear settlement must not repeat the fill");
  } finally {
    Date.now = nativeDateNow;
  }
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
  await exerciseFailedEvidenceReadback(result, Object.freeze({ timeoutMs: 1_000 }), serialized!);
}

await exerciseBrowserRejectedEvidenceReadback();
await exerciseBrowserRejectedDispatchedEvidenceReadback();
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
  let simulatedNow = 0;
  let reads = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      reads += 1;
      return coherentObservationPacket(intent, conversationFacts(), reads < 4
        ? "https://chatgpt.com/" : conversationUrl);
    }
    throw new Error(`UNEXPECTED_SETTLING_FOCUS_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("focus_exact_gpt_conversation", fixture.browser, {
      canonicalConversationUrl: conversationUrl,
    });
    assert.equal(result.status, "success", result.failureCode ?? "settled exact conversation focus failed");
    assert.equal(simulatedNow, 250,
      "exact navigation must consume fresh observations and stop before the 2500ms ceiling");
    assert.equal(fixture.physicalMutations(), 1, "navigation settlement must not repeat navigation");
  } finally {
    Date.now = nativeDateNow;
  }
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
      assert.equal(GPT_MORE_ACTIONS_BUTTON_LABEL, "更多操作");
      assert.equal(
        intent.selector,
        `[data-testid="conversation-turn-2"][data-turn='assistant'] button[aria-label='更多操作'][aria-haspopup='menu']`,
      );
      assert.equal(intent.selector, gptMoreActionsButtonSelector(sourceInput.sourceAssistantTurnId));
      assert.equal(intent.selector.includes("more-turn-action-button"), false);
      assert.equal(intent.selector.includes("aria-expanded"), false);
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
  let destinationOpen = false;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, conversationFacts({
        promptHash, assistant: true, menuOpen: true, destinationOpen,
      }), conversationUrl);
    }
    if (intent.kind === "readExactAssistantTurn") {
      return exactAssistantTurnReply(intent.assistantTurnId, responseText);
    }
    if (intent.kind === "click") {
      assert.equal(intent.expectedTextEquals, "打开新分支");
      destinationOpen = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_DESTINATION_MENU_INTENT:${intent.kind}`);
  });
  const result = await execute("open_gpt_fork_destination_menu", fixture.browser, sourceInput);
  assert.equal(result.status, "success", result.failureCode ?? "fork destination menu open failed");
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
        destinationOpen: !forked,
      }), forked ? childConversationUrl : conversationUrl);
    }
    if (intent.kind === "readExactAssistantTurn") {
      return exactAssistantTurnReply(intent.assistantTurnId, responseText);
    }
    if (intent.kind === "click") {
      assert.equal(intent.expectedTextEquals, "分支到新聊天");
      assert.equal(intent.postClickTargetTransition?.kind, "gpt-fork-successor");
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
  let simulatedNow = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, responseFacts(), conversationUrl);
    if (intent.kind === "readExactAssistantTurn") {
      return exactAssistantTurnReply(intent.assistantTurnId, responseText);
    }
    throw new Error(`UNEXPECTED_TEXT_RESPONSE_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const expired = await execute("wait_for_stable_gpt_text", fixture.browser, {
      absoluteDeadline: new Date(-1).toISOString(), canonicalConversationUrl: conversationUrl,
      expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(expired.status, "failed");
    assert.equal(expired.failureCode, "GPT_RESPONSE_STABILITY_TIMEOUT");
    assert.equal(fixture.documentCalls(), 0, "expired text deadline must fail before observing the page");
    const waited = await execute("wait_for_stable_gpt_text", fixture.browser, {
      absoluteDeadline: new Date(1_000).toISOString(), canonicalConversationUrl: conversationUrl,
      expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(waited.status, "success", waited.failureCode ?? "stable text wait failed");
    assert.equal(waited.value?.responseText, responseText);
    assert.equal(fixture.waitDurations().length, 1, "stable text requires two separated observations");
  } finally {
    Date.now = nativeDateNow;
  }
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
  let simulatedNow = 0;
  const original = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>',
  );
  const mediaHash = hash(original);
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, responseFacts(), conversationUrl);
    throw new Error(`UNEXPECTED_IMAGE_RESPONSE_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; }, authenticatedMedia: {
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
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const expired = await execute("wait_for_stable_gpt_image", fixture.browser, {
      absoluteDeadline: new Date(-1).toISOString(), canonicalConversationUrl: conversationUrl,
      expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(expired.status, "failed");
    assert.equal(expired.failureCode, "GPT_IMAGE_STABILITY_TIMEOUT");
    assert.equal(fixture.authenticatedMediaDownloads(), 0,
      "expired image deadline must fail before downloading media");
    const waited = await execute("wait_for_stable_gpt_image", fixture.browser, {
      absoluteDeadline: new Date(1_000).toISOString(), canonicalConversationUrl: conversationUrl,
      expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(waited.status, "success", waited.failureCode ?? "stable image wait failed");
    assert.equal(waited.value?.mediaHash, mediaHash);
    assert.equal(fixture.authenticatedMediaDownloads(), 2,
      "stable image requires two equal authenticated downloads");
  } finally {
    Date.now = nativeDateNow;
  }
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
