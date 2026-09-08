import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { throwGptChildFailure } from "../production-child-support.js";
import { serializeTerminalFailure } from "../../../lib/local-runtime/production/terminal-failure.js";
import { executionFailure } from "../../../lib/execution-failure.js";
import {
  exerciseBrowserDispatchedEvidenceReadback,
  exerciseBrowserRejectedDispatchedEvidenceReadback,
  exerciseBrowserRejectedEvidenceReadback,
  exerciseConfirmedProviderReadbackEvidenceLifecycle,
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
      probeBudgetMs: 40_000, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      navigateCrossConversationPoll: async (canonicalConversationUrl) => {
        gateCalls += 1;
        if (gateCalls === 1) {
          fixture.normalReacquire();
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
  let simulatedNow = 0;
  const otherConversationUrl = `${conversationUrl}-stale-boundary`;
  let fixture!: ReturnType<typeof fakeBrowser>;
  fixture = fakeBrowser((intent, callNumber) => {
    if (intent.kind === "observe") {
      if (callNumber === 1) fixture.normalReacquire();
      return coherentObservationPacket(
        intent, responseFacts(), callNumber === 1 ? otherConversationUrl : conversationUrl,
      );
    }
    if (intent.kind === "readExactAssistantTurn") return exactAssistantTurnReply(intent, responseText);
    throw new Error(`UNEXPECTED_STALE_BOUNDARY_NAVIGATION_INTENT:${intent.kind}`);
  }, { initialUrl: otherConversationUrl, onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
      probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      navigateCrossConversationPoll: async (canonicalConversationUrl) => {
        await fixture.browser.navigate({
          url: canonicalConversationUrl, title: "poll exact GPT conversation",
        });
        return "navigated";
      },
    });
    assert.equal(result.status, "success", result.failureCode
      ?? "exact navigation must be checked from its immediate Browser boundary");
    assert.equal(fixture.browser.document.navigationEpoch, 3);
  } finally {
    Date.now = nativeDateNow;
  }
}

{
  const { execute } = freshHarness();
  const otherConversationUrl = `${conversationUrl}-discontinuous-navigation`;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, responseFacts(), otherConversationUrl);
    }
    throw new Error(`UNEXPECTED_DISCONTINUOUS_NAVIGATION_INTENT:${intent.kind}`);
  }, { initialUrl: otherConversationUrl });
  const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
    probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
    conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
  }, undefined, {
    navigateCrossConversationPoll: async (canonicalConversationUrl) => {
      fixture.normalReacquire();
      await fixture.browser.navigate({
        url: canonicalConversationUrl, title: "poll exact GPT conversation",
      });
      return "navigated";
    },
  });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_CONVERSATION_URL_MISMATCH",
    "a forward exact-navigation boundary must still fail when the fresh page identity is wrong");
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
      probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
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
      probeBudgetMs: 100, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      navigateCrossConversationPoll: async () => {
        fixture.normalReacquire();
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
    probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
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
    probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
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
      probeBudgetMs: 100, canonicalConversationUrl: conversationUrl,
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
  let simulatedNow = 0;
  const nativeDateNow = Date.now;
  const original = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>',
  );
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      simulatedNow = 100;
      return coherentObservationPacket(intent, responseFacts(), conversationUrl);
    }
    throw new Error(`UNEXPECTED_EXPIRED_IMAGE_OBSERVATION_INTENT:${intent.kind}`);
  }, { authenticatedMedia: {
    authorityTargetHash: `sha256:${"2".repeat(64)}`,
    authorityDocumentHash: `sha256:${"3".repeat(64)}`,
    assistantTurnId: "conversation-turn-2", semanticMediaId: "gpt-generated-image-main",
    bytesBase64: original.toString("base64"), sha256: hash(original), sizeBytes: original.byteLength,
    mediaType: "image/svg+xml", width: 16, height: 16,
  } });
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_image", fixture.browser, {
      probeBudgetMs: 100, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "GPT_IMAGE_STABILITY_TIMEOUT");
  } finally {
    Date.now = nativeDateNow;
  }
  assert.equal(fixture.authenticatedMediaDownloads(), 0,
    "an observation completed at the immutable deadline must not authorize a media download");
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
    probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
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
  const waitInput = Object.freeze({
    probeBudgetMs: 1_000,
    canonicalConversationUrl: conversationUrl,
    conversationIdentityHash,
    expectedPromptHash: promptHash,
    turnMarker: marker,
  });
  const confirmedProviderSubmitReceipt = Object.freeze({
    sourceAttemptId: "attempt:gpt-exact-target",
    sourceExactCallIdentityHash: `sha256:${"a".repeat(64)}` as const,
    sourceActionOrdinal: 0,
    sourceProductStepId: "acceptance:gpt-browser-handoff",
    sourceCallId: "turn-submit",
    sourceTargetRef: "target:confirmed-submit",
    sourceDocumentRef: "document:confirmed-submit",
    readbackDocumentRefHash: hash("document:confirmed-submit"),
    sourceTerminalAt: "2026-09-07T00:00:00.000Z",
    evidenceRef: "evidence:confirmed-submit",
    evidenceHash: `sha256:${"b".repeat(64)}` as const,
    promptHash,
    turnMarker: marker,
  });
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      throw executionFailure("failed", "BROWSER_DOM_READ_INVALID");
    }
    throw new Error(`POST_SUBMIT_READBACK_FAULT_MUST_NOT_MUTATE:${intent.kind}`);
  });
  const result = await execute(
    "wait_for_stable_gpt_text",
    fixture.browser,
    waitInput,
    undefined,
    { confirmedProviderSubmitReceipt },
  );
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "BROWSER_DOM_READ_INVALID");
  assert.equal(result.proof.committedMutation, "no");
  assert.equal(result.proof.postconditionResult, "pending");
  assert.equal(fixture.physicalMutations(), 0);
  await exerciseConfirmedProviderReadbackEvidenceLifecycle(
    result,
    waitInput,
    confirmedProviderSubmitReceipt,
  );
}
