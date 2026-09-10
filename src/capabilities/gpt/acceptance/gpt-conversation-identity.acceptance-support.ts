import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { throwGptChildFailure } from "../production-child-support.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
import {
  exerciseBrowserDispatchedEvidenceReadback,
  exerciseBrowserRejectedDispatchedEvidenceReadback,
  exerciseBrowserRejectedEvidenceReadback,
  exerciseContinuationPageInputRoleEvidence,
  exerciseFailedEvidenceReadback,
} from "./gpt-failure-evidence-readback.acceptance-support.js";
import {
  coherentObservationPacket,
  exactAssistantTurnReply,
  fakeBrowser,
} from "./gpt-exact-target-browser-fixture.js";
import {
  EMPTY_HASH,
  conversationFacts,
  conversationUrl,
  freshHarness,
  hash,
  marker,
  promptHash,
  responseHash,
  responseText,
  sourceInput,
} from "./gpt-conversation-fixture.js";
import {
  GPT_MORE_ACTIONS_BUTTON_LABEL,
  gptMoreActionsButtonSelector,
} from "./gpt-page-fixture-selectors.js";

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
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "GPT_CHAT_DRAFT_CLEAR_FAILED");
    assert.equal(reads, 2, "GPT must consume only one Browser-admitted fresh post-action read");
    assert.equal(simulatedNow, 0, "GPT must not own a second post-action timer");
    assert.equal(fixture.physicalMutations(), 1, "draft readback failure must not repeat the fill");
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
      return coherentObservationPacket(intent, conversationFacts({ promptHash }),
        reads === 1 ? "https://chatgpt.com/" : conversationUrl);
    }
    throw new Error(`UNEXPECTED_FOCUS_INTENT:${intent.kind}`);
  });
  const result = await execute("focus_exact_gpt_conversation", fixture.browser, {
    canonicalConversationUrl: conversationUrl, expectedPromptHash: promptHash, turnMarker: marker,
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
      return coherentObservationPacket(intent, conversationFacts({ promptHash }), reads < 4
        ? "https://chatgpt.com/" : conversationUrl);
    }
    throw new Error(`UNEXPECTED_SETTLING_FOCUS_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("focus_exact_gpt_conversation", fixture.browser, {
      canonicalConversationUrl: conversationUrl, expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(result.status, "success", result.failureCode ?? "settling navigation did not converge");
    assert.equal(reads, 4, "GPT must poll only until the exact conversation identity is stable");
    assert.ok(simulatedNow > 0 && simulatedNow < 5_000,
      "the bounded post-navigation observation window must stop as soon as identity is stable");
    assert.equal(fixture.physicalMutations(), 1, "navigation readback failure must not repeat navigation");
  } finally {
    Date.now = nativeDateNow;
  }
}

{
  const { execute } = freshHarness();
  let simulatedNow = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, conversationFacts({ promptHash }), "https://chatgpt.com/");
    }
    throw new Error(`UNEXPECTED_NEVER_SETTLING_FOCUS_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("focus_exact_gpt_conversation", fixture.browser, {
      canonicalConversationUrl: conversationUrl, expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "GPT_CONVERSATION_NAVIGATION_NOT_YET_CONFIRMED");
    assert.ok(simulatedNow >= 4_975 && simulatedNow <= 5_000,
      "an unstable conversation must fail within one minimum wait slice of the bounded deadline");
    assert.equal(fixture.physicalMutations(), 1, "the bounded observation window must never repeat navigation");
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
      return exactAssistantTurnReply(intent, responseText);
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
      return exactAssistantTurnReply(intent, responseText);
    }
    if (intent.kind === "click") {
      assert.equal(GPT_MORE_ACTIONS_BUTTON_LABEL, "更多操作");
      assert.equal(
        intent.selector,
        `[data-testid="conversation-turn-2"]:has([data-message-author-role='assistant']) button[aria-label='更多操作']`,
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
  await exerciseContinuationPageInputRoleEvidence(result, sourceInput);
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
      return exactAssistantTurnReply(intent, responseText);
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
  await exerciseContinuationPageInputRoleEvidence(result, sourceInput);
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...conversationFacts({ promptHash, assistant: true, menuOpen: true }),
      "checkpoint-menu": {
        rawCount: 1, eligibleCount: 1,
        matches: [{ id: "source-turn-menu", ariaLabelledBy: "another-turn-trigger" }],
      },
    }, conversationUrl);
    if (intent.kind === "readExactAssistantTurn") return exactAssistantTurnReply(intent, responseText);
    throw new Error(`WRONG_CHECKPOINT_MENU_OWNER_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("open_gpt_checkpoint_actions_menu", fixture.browser, sourceInput);
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_CHECKPOINT_ACTIONS_MENU_AMBIGUOUS");
  assert.equal(fixture.physicalMutations(), 0, "another turn's menu must never satisfy DONE");
}
