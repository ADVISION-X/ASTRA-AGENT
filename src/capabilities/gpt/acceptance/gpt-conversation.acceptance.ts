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
  conversationIdentityHash,
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
  let simulatedNow = 0;
  let gateCalls = 0;
  const otherConversationUrl = "https://chatgpt.com/c/other-conversation";
  const fixture = fakeBrowser((intent, callNumber) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(
        intent,
        responseFacts(),
        callNumber <= 2 ? otherConversationUrl : conversationUrl,
      );
    }
    if (intent.kind === "readExactAssistantTurn") {
      return exactAssistantTurnReply(intent, responseText);
    }
    throw new Error(`UNEXPECTED_CROSS_CONVERSATION_TEXT_INTENT:${intent.kind}`);
  }, { initialUrl: otherConversationUrl, onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
      absoluteDeadline: new Date(40_000).toISOString(), canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      navigateCrossConversationPoll: async (canonicalConversationUrl) => {
        gateCalls += 1;
        if (gateCalls === 1) {
          simulatedNow = 30_000;
          return "reobserve";
        }
        await fixture.browser.navigate({
          url: canonicalConversationUrl, title: "poll exact GPT conversation",
        });
        return "navigated";
      },
    });
    assert.equal(result.status, "success", result.failureCode ?? "cross-conversation wait failed");
  } finally {
    Date.now = nativeDateNow;
  }
  assert.equal(gateCalls, 2, "reacquire must fresh-observe before competing for the shared eligibility again");
  assert.equal(fixture.physicalMutations(), 1, "the cross-conversation result poll must navigate exactly once");
}

{
  const { execute } = freshHarness();
  const transientUrl = "https://chatgpt.com/c/WEB:transient-child";
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, conversationFacts({ promptHash }), "https://chatgpt.com/");
    }
    throw new Error(`UNEXPECTED_TRANSIENT_FOCUS_INTENT:${intent.kind}`);
  });
  const result = await execute("focus_exact_gpt_conversation", fixture.browser, {
    canonicalConversationUrl: transientUrl, expectedPromptHash: promptHash, turnMarker: marker,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_TRANSIENT_WEB_CONVERSATION_NAVIGATION_FORBIDDEN");
  assert.equal(fixture.physicalMutations(), 0, "a transient WEB route must never be navigated");
}

{
  const { execute } = freshHarness();
  let simulatedNow = 0;
  let gateCalls = 0;
  const otherConversationUrl = "https://chatgpt.com/c/other-image-conversation";
  const original = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>',
  );
  const mediaHash = hash(original);
  const fixture = fakeBrowser((intent, callNumber) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(
        intent, responseFacts(), callNumber === 1 ? otherConversationUrl : conversationUrl,
      );
    }
    throw new Error(`UNEXPECTED_CROSS_CONVERSATION_IMAGE_INTENT:${intent.kind}`);
  }, { initialUrl: otherConversationUrl, onWait: (durationMs) => { simulatedNow += durationMs; },
    authenticatedMedia: {
      authorityTargetHash: `sha256:${"2".repeat(64)}`,
      authorityDocumentHash: `sha256:${"3".repeat(64)}`,
      assistantTurnId: "conversation-turn-2", semanticMediaId: "gpt-generated-image-main",
      bytesBase64: original.toString("base64"), sha256: mediaHash, sizeBytes: original.byteLength,
      mediaType: "image/svg+xml", width: 16, height: 16,
    } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_image", fixture.browser, {
      absoluteDeadline: new Date(1_000).toISOString(), canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      navigateCrossConversationPoll: async (canonicalConversationUrl) => {
        gateCalls += 1;
        await fixture.browser.navigate({
          url: canonicalConversationUrl, title: "poll exact GPT conversation",
        });
        return "navigated";
      },
    });
    assert.equal(result.status, "success", result.failureCode ?? "cross-conversation image wait failed");
  } finally {
    Date.now = nativeDateNow;
  }
  assert.equal(gateCalls, 1);
  assert.equal(fixture.physicalMutations(), 1);
  assert.equal(fixture.authenticatedMediaDownloads(), 2);
}

{
  const { execute } = freshHarness();
  let simulatedNow = 0;
  const otherConversationUrl = "https://chatgpt.com/c/deadline-other-conversation";
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, responseFacts(), otherConversationUrl);
    throw new Error(`UNEXPECTED_DEADLINE_CROSS_CONVERSATION_INTENT:${intent.kind}`);
  }, { initialUrl: otherConversationUrl });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
      absoluteDeadline: new Date(100).toISOString(), canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      navigateCrossConversationPoll: async () => {
        simulatedNow = 100;
        return "reobserve";
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "GPT_RESPONSE_STABILITY_TIMEOUT");
  } finally {
    Date.now = nativeDateNow;
  }
  assert.equal(fixture.physicalMutations(), 0,
    "a cross-conversation poll whose immutable deadline expires while parked must not navigate");
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(
        intent, responseFacts(), "https://chatgpt.com/c/text-deadline-outcome",
      );
    }
    throw new Error(`UNEXPECTED_TEXT_DEADLINE_OUTCOME_INTENT:${intent.kind}`);
  });
  const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
    absoluteDeadline: new Date(Date.now() + 1_000).toISOString(), canonicalConversationUrl: conversationUrl,
    conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
  }, undefined, { navigateCrossConversationPoll: async () => "deadline" });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_RESPONSE_STABILITY_TIMEOUT");
  assert.equal(fixture.physicalMutations(), 0,
    "the text wait deadline gate outcome must fail without cross-conversation navigation");
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(
        intent, responseFacts(), "https://chatgpt.com/c/image-deadline-outcome",
      );
    }
    throw new Error(`UNEXPECTED_IMAGE_DEADLINE_OUTCOME_INTENT:${intent.kind}`);
  });
  const result = await execute("wait_for_stable_gpt_image", fixture.browser, {
    absoluteDeadline: new Date(Date.now() + 1_000).toISOString(), canonicalConversationUrl: conversationUrl,
    conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
  }, undefined, { navigateCrossConversationPoll: async () => "deadline" });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_IMAGE_STABILITY_TIMEOUT");
  assert.equal(fixture.physicalMutations(), 0,
    "the image wait deadline gate outcome must fail without cross-conversation navigation");
}

{
  const { execute } = freshHarness();
  let simulatedNow = 0;
  const nativeDateNow = Date.now;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      simulatedNow = 100;
      return coherentObservationPacket(intent, responseFacts(), conversationUrl);
    }
    throw new Error(`UNEXPECTED_EXPIRED_TARGET_CONVERSATION_INTENT:${intent.kind}`);
  });
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
      absoluteDeadline: new Date(100).toISOString(), canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "GPT_RESPONSE_STABILITY_TIMEOUT");
  } finally {
    Date.now = nativeDateNow;
  }
  assert.equal(fixture.physicalMutations(), 0,
    "a fresh target-URL observation completed at the immutable deadline must not be accepted");
}

{
  const { execute } = freshHarness();
  const controller = new AbortController();
  let gateCalls = 0;
  const otherConversationUrl = "https://chatgpt.com/c/aborted-other-conversation";
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      controller.abort();
      return coherentObservationPacket(intent, responseFacts(), otherConversationUrl);
    }
    throw new Error(`UNEXPECTED_ABORTED_CROSS_CONVERSATION_INTENT:${intent.kind}`);
  });
  const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
    absoluteDeadline: new Date(Date.now() + 1_000).toISOString(), canonicalConversationUrl: conversationUrl,
    conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
  }, undefined, {
    signal: controller.signal,
    navigateCrossConversationPoll: async () => {
      gateCalls += 1;
      return "navigated";
    },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_RESPONSE_WAIT_ABORTED");
  assert.equal(gateCalls, 0, "abort during fresh observation must stop before reserving poll eligibility");
  assert.equal(fixture.physicalMutations(), 0,
    "abort during fresh observation must stop before cross-conversation navigation");
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

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...conversationFacts({ promptHash, assistant: true, menuOpen: true, destinationOpen: true }),
      "destination-menu": {
        rawCount: 1, eligibleCount: 1,
        matches: [{ id: "fork-destination-menu", ariaLabelledBy: "another-fork-trigger" }],
      },
    }, conversationUrl);
    if (intent.kind === "readExactAssistantTurn") return exactAssistantTurnReply(intent, responseText);
    throw new Error(`WRONG_DESTINATION_MENU_OWNER_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("open_gpt_fork_destination_menu", fixture.browser, sourceInput);
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_FORK_DESTINATION_MENU_AMBIGUOUS");
  assert.equal(fixture.physicalMutations(), 0, "another parent entry's submenu must never satisfy DONE");
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...conversationFacts({ promptHash, assistant: true, menuOpen: true, destinationOpen: true }),
      "destination-menu": {
        rawCount: 1, eligibleCount: 1,
        matches: [{ id: "fork-destination-menu", ariaLabelledBy: "another-fork-trigger" }],
      },
    }, conversationUrl);
    if (intent.kind === "readExactAssistantTurn") return exactAssistantTurnReply(intent, responseText);
    throw new Error(`WRONG_FINAL_FORK_OWNER_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("fork_exact_gpt_conversation_at_checkpoint", fixture.browser, sourceInput);
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_FORK_ACTION_NOT_UNIQUE");
  assert.equal(fixture.physicalMutations(), 0, "another parent entry's submenu must never fork");
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...conversationFacts({ promptHash, assistant: true, menuOpen: true, destinationOpen: true }),
      "source-trigger": {
        rawCount: 1, eligibleCount: 1,
        matches: [{ id: "source-turn-trigger", ariaExpanded: "true", ariaControls: "" }],
      },
      "checkpoint-menu": {
        rawCount: 1, eligibleCount: 1,
        matches: [{ id: "source-turn-menu" }],
      },
    }, conversationUrl);
    if (intent.kind === "readExactAssistantTurn") return exactAssistantTurnReply(intent, responseText);
    throw new Error(`OWNERLESS_FINAL_FORK_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("fork_exact_gpt_conversation_at_checkpoint", fixture.browser, sourceInput);
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_FORK_ACTION_NOT_UNIQUE");
  assert.equal(fixture.physicalMutations(), 0, "a menu with no owner relation must never fork");
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
      return exactAssistantTurnReply(intent, responseText);
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
      return exactAssistantTurnReply(intent, responseText);
    }
    throw new Error(`UNEXPECTED_TEXT_RESPONSE_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const expired = await execute("wait_for_stable_gpt_text", fixture.browser, {
      absoluteDeadline: new Date(-1).toISOString(), canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(expired.status, "failed");
    assert.equal(expired.failureCode, "GPT_RESPONSE_STABILITY_TIMEOUT");
    assert.equal(fixture.documentCalls(), 0, "expired text deadline must fail before observing the page");
    const waited = await execute("wait_for_stable_gpt_text", fixture.browser, {
      absoluteDeadline: new Date(1_000).toISOString(), canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
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
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(expired.status, "failed");
    assert.equal(expired.failureCode, "GPT_IMAGE_STABILITY_TIMEOUT");
    assert.equal(fixture.authenticatedMediaDownloads(), 0,
      "expired image deadline must fail before downloading media");
    const waited = await execute("wait_for_stable_gpt_image", fixture.browser, {
      absoluteDeadline: new Date(1_000).toISOString(), canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
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
  const downloadsBeforeMismatch = fixture.authenticatedMediaDownloads();
  const predecessorMismatch = await execute("checkpoint_gpt_generated_image", fixture.browser, {
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
      promptHash: hash("another-prompt"),
      turnMarker: marker,
      evidenceRef: "evidence:text",
      evidenceHash: hash("evidence"),
    },
    turnMarker: marker,
  });
  assert.equal(predecessorMismatch.status, "failed");
  assert.equal(predecessorMismatch.failureCode, "GPT_GENERATED_IMAGE_PREDECESSOR_MISMATCH");
  assert.equal(fixture.authenticatedMediaDownloads(), downloadsBeforeMismatch,
    "a wrong predecessor receipt must fail before reading image bytes");
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
