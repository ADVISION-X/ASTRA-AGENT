import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import {
  exerciseContinuationPageInputRoleEvidence,
} from "./gpt-failure-evidence-readback.acceptance-support.js";
import {
  coherentObservationPacket,
  exactAssistantTurnReply,
  fakeBrowser,
} from "./gpt-exact-target-browser-fixture.js";
import { browserExecutionFailure } from "../../../lib/browser/browser-authority-api.js";
import { failureCode } from "../../../lib/execution-failure.js";
import { executeProductionGptAtomicCall } from "../production-atomic-call.js";
import { gptExactCallIdentityHash } from "../contract.js";
import {
  EMPTY_HASH,
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
  await exerciseContinuationPageInputRoleEvidence(result, sourceInput);
}


{
  const { execute } = freshHarness();
  let simulatedNow = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, responseFacts(), conversationUrl);
    }
    if (intent.kind === "readExactAssistantTurn") {
      return exactAssistantTurnReply(intent, responseText);
    }
    throw new Error(`UNEXPECTED_TEXT_RESPONSE_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const expired = await execute("wait_for_stable_gpt_text", fixture.browser, {
      probeBudgetMs: -1, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(expired.status, "failed");
    assert.equal(expired.failureCode, "GPT_RESPONSE_PROBE_BUDGET_INVALID");
    assert.equal(fixture.documentCalls(), 0, "invalid text probe budget must fail before observing the page");
    const waited = await execute("wait_for_stable_gpt_text", fixture.browser, {
      probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
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
  let waits = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, {
        ...responseFacts(),
        generating: waits === 0
          ? { rawCount: 1, eligibleCount: 1, matches: [{}] }
          : { rawCount: 0, eligibleCount: 0, matches: [] },
      }, conversationUrl);
    }
    if (intent.kind === "readExactAssistantTurn") return exactAssistantTurnReply(intent, responseText);
    throw new Error(`UNEXPECTED_NORMAL_REACQUIRE_TEXT_INTENT:${intent.kind}`);
  }, {
    navigationEpochAdvanceOnWait: 1,
    onWait: (durationMs) => { waits += 1; simulatedNow += durationMs; },
  });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
      probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      yieldForProviderWait: (durationMs) => fixture.browser.wait({ durationMs }),
    });
    assert.equal(result.status, "success", result.failureCode ?? "normal text reacquire wait failed");
  } finally {
    Date.now = nativeDateNow;
  }
  assert.equal(waits, 2, "text waits must accept two separately proven normal reacquires");
  assert.equal(fixture.browser.document.navigationEpoch, 3);
}

{
  const { execute } = freshHarness();
  let simulatedNow = 0;
  let waits = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, {
        ...responseFacts(),
        generating: waits === 0
          ? { rawCount: 1, eligibleCount: 1, matches: [{}] }
          : { rawCount: 0, eligibleCount: 0, matches: [] },
      }, conversationUrl);
    }
    if (intent.kind === "readExactAssistantTurn") return exactAssistantTurnReply(intent, responseText);
    throw new Error(`UNEXPECTED_DOCUMENT_JUMP_TEXT_INTENT:${intent.kind}`);
  }, {
    navigationEpochAdvanceOnWait: 2,
    onWait: (durationMs) => { waits += 1; simulatedNow += durationMs; },
  });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
      probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      yieldForProviderWait: (durationMs) => fixture.browser.wait({ durationMs }),
    });
    assert.equal(result.status, "success", result.failureCode
      ?? "Browser-proven forward Document reacquires must permit semantic text reproof");
    assert.equal(result.value?.responseText, responseText);
  } finally {
    Date.now = nativeDateNow;
  }
  assert.equal(waits, 2, "each forward reacquire must be followed by a fresh semantic observation");
  assert.equal(fixture.browser.document.navigationEpoch, 5,
    "GPT must not reinterpret multiple Browser-owned Document advances as an identity failure");
}

{
  const { execute } = freshHarness();
  let simulatedNow = 0;
  let waits = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, responseFacts(), conversationUrl);
    if (intent.kind === "readExactAssistantTurn") return exactAssistantTurnReply(intent, responseText);
    throw new Error(`UNEXPECTED_SAME_DOCUMENT_REACQUIRE_TEXT_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { waits += 1; simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
      probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      yieldForProviderWait: (durationMs) => fixture.browser.wait({ durationMs }),
    });
    assert.equal(result.status, "success", result.failureCode
      ?? "a Browser-proven reacquire may retain the same current Document");
  } finally {
    Date.now = nativeDateNow;
  }
  assert.equal(waits, 1);
  assert.equal(fixture.browser.document.navigationEpoch, 1);
}

{
  const { execute } = freshHarness();
  let simulatedNow = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, {
        ...responseFacts(),
        generating: { rawCount: 1, eligibleCount: 1, matches: [{}] },
      }, conversationUrl);
    }
    throw new Error(`UNEXPECTED_PHYSICALLY_ABSENT_TEXT_INTENT:${intent.kind}`);
  });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("wait_for_stable_gpt_text", fixture.browser, {
      probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash, expectedPromptHash: promptHash, turnMarker: marker,
    }, undefined, {
      yieldForProviderWait: async () => {
        fixture.normalReacquire();
        throw browserExecutionFailure(new Error("BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT"), "no");
      },
    });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "BROWSER_EXACT_TARGET_PHYSICALLY_ABSENT",
      "a Browser reacquire failure must not be relabeled as a Document transition failure");
  } finally {
    Date.now = nativeDateNow;
  }
  assert.equal(fixture.physicalMutations(), 0,
    "a failed normal reacquire must not issue a second Provider mutation");
}

{
  const { execute } = freshHarness();
  let simulatedNow = 0;
  const predecessorPromptHash = hash("predecessor-prompt");
  const predecessorMarker = "[GRASSEYE:gpt-native-image-predecessor]";
  const imageConversationIdentityHash = hash(
    `${conversationUrl}\n${marker}\nconversation-turn-3\n${promptHash}`,
  );
  const original = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>',
  );
  const mediaHash = hash(original);
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, {
        ...responseFacts(),
        "user-turns": {
          rawCount: 2, eligibleCount: 2, matches: [
            { testId: "conversation-turn-1", exactGptUserPromptHash: predecessorPromptHash },
            { testId: "conversation-turn-3", exactGptUserPromptHash: promptHash },
          ],
        },
        "assistant-turns": {
          rawCount: 2, eligibleCount: 2, matches: [
            { testId: "conversation-turn-2", semanticTextHash: responseHash },
            { testId: "conversation-turn-4", semanticTextHash: EMPTY_HASH },
          ],
        },
      }, conversationUrl);
    }
    throw new Error(`UNEXPECTED_IMAGE_RESPONSE_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; }, authenticatedMedia: {
    authorityTargetHash: `sha256:${"2".repeat(64)}`,
    authorityDocumentHash: `sha256:${"3".repeat(64)}`,
    assistantTurnId: "conversation-turn-4",
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
      probeBudgetMs: -1, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash: imageConversationIdentityHash,
      expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(expired.status, "failed");
    assert.equal(expired.failureCode, "GPT_RESPONSE_PROBE_BUDGET_INVALID");
    assert.equal(fixture.authenticatedMediaDownloads(), 0,
      "invalid image probe budget must fail before downloading media");
    const waited = await execute("wait_for_stable_gpt_image", fixture.browser, {
      probeBudgetMs: 1_000, canonicalConversationUrl: conversationUrl,
      conversationIdentityHash: imageConversationIdentityHash,
      expectedPromptHash: promptHash, turnMarker: marker,
    });
    assert.equal(waited.status, "success", waited.failureCode ?? "stable image wait failed");
    assert.equal(waited.value?.mediaHash, mediaHash);
    assert.equal(fixture.authenticatedMediaDownloads(), 2,
      "stable image requires two equal authenticated downloads");
  } finally {
    Date.now = nativeDateNow;
  }
  const imageInput = Object.freeze({
    assistantTurnId: "conversation-turn-4",
    canonicalConversationUrl: conversationUrl,
    expectedMediaHash: mediaHash,
    expectedPromptHash: promptHash,
    predecessorTextCheckpoint: {
      checkpointKind: "text" as const,
      sourceAttemptId: "attempt:source",
      assistantTurnId: "conversation-turn-2",
      artifactRef: "artifact:text",
      rawDomHash: hash("raw-dom"),
      semanticTextHash: responseHash,
      canonicalConversationUrl: conversationUrl,
      promptHash: predecessorPromptHash,
      turnMarker: predecessorMarker,
      evidenceRef: "evidence:text",
      evidenceHash: hash("evidence"),
    },
    turnMarker: marker,
  });
  const checkpoint = await execute("checkpoint_gpt_generated_image", fixture.browser, imageInput);
  assert.equal(checkpoint.status, "success", checkpoint.failureCode ?? "image checkpoint failed");
  assert.equal(checkpoint.value?.mediaType, "image/webp");
  assert.equal(checkpoint.value?.width, 1200);
  assert.equal(checkpoint.value?.height, 630);
  assert.equal(fixture.physicalMutations(), 1,
    "the final image checkpoint must execute one Browser-owned visible download compound mutation");
  const recovery = Object.freeze({
    state: "dispatched" as const,
    mutationOutcome: "dispatched" as const,
    terminalAt: null,
    failureCode: null,
    nativeFailureCode: null,
    authorityRef: "browser-mutation:image-checkpoint-response-loss",
    authorityHash: hash("image-checkpoint-response-loss"),
    targetRef: "target:1",
    documentRef: "document:1",
    physicalInputCount: 2 as const,
    downloadGuidHash: hash("native-download-guid"),
    downloadCompleted: true,
    identityRevalidated: true,
  });
  const recoveryFixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...responseFacts(),
      "user-turns": {
        rawCount: 2, eligibleCount: 2, matches: [
          { testId: "conversation-turn-1", exactGptUserPromptHash: predecessorPromptHash },
          { testId: "conversation-turn-3", exactGptUserPromptHash: promptHash },
        ],
      },
      "assistant-turns": {
        rawCount: 2, eligibleCount: 2, matches: [
          { testId: "conversation-turn-2", semanticTextHash: responseHash },
          { testId: "conversation-turn-4", semanticTextHash: EMPTY_HASH },
        ],
      },
    }, conversationUrl);
    throw new Error(`UNEXPECTED_IMAGE_RECOVERY_INTENT:${intent.kind}`);
  }, {
    initialPending: 1,
    initialRecovery: recovery,
    authenticatedMedia: {
      authorityTargetHash: `sha256:${"2".repeat(64)}`,
      authorityDocumentHash: `sha256:${"3".repeat(64)}`,
      assistantTurnId: "conversation-turn-4",
      semanticMediaId: "gpt-generated-image-main",
      bytesBase64: original.toString("base64"),
      sha256: mediaHash,
      sizeBytes: original.byteLength,
      mediaType: "image/svg+xml",
      width: 16,
      height: 16,
    },
  });
  const recoveryIdentity = Object.freeze({
    jobId: "job:gpt-image-response-loss",
    attemptId: "attempt:gpt-image-response-loss",
    pluginId: "acceptance-product",
    pluginVersion: 1,
    productStepId: "article_image_generation",
    callId: "image-checkpoint",
    childCapabilityId: "checkpoint_gpt_generated_image" as const,
    inputHash: hash(JSON.stringify(imageInput)),
  });
  const recoveryIntent = Object.freeze({
    ...recoveryIdentity,
    executionId: `gpt-call:${gptExactCallIdentityHash(recoveryIdentity).slice(7)}`,
    actionOrdinal: 48,
    input: imageInput,
  });
  await assert.rejects(executeProductionGptAtomicCall({
    dataDir: "/tmp/gpt-image-response-loss",
    gpt: freshHarness().gpt,
    store: {} as never,
    browsers: {} as never,
    intent: recoveryIntent,
    browserCall: {
      browser: recoveryFixture.browser,
      facade: recoveryFixture.browser,
      providerWaitLog: null,
    },
    signal: new AbortController().signal,
  }), (error: unknown) => failureCode(error) === "GPT_ATOMIC_STEP_ALREADY_ATTEMPTED");
  assert.equal(recoveryFixture.physicalMutations(), 0,
    "an ended image attempt must never click image or save again");
  assert.equal(recoveryFixture.authenticatedMediaDownloads(), 0,
    "an ended image attempt must not read old media bytes");
  const downloadsBeforeMismatch = fixture.authenticatedMediaDownloads();
  const predecessorMismatch = await execute("checkpoint_gpt_generated_image", fixture.browser, {
    assistantTurnId: "conversation-turn-4",
    canonicalConversationUrl: conversationUrl,
    expectedMediaHash: mediaHash,
    expectedPromptHash: promptHash,
    predecessorTextCheckpoint: {
      checkpointKind: "text",
      sourceAttemptId: "attempt:source",
      assistantTurnId: "conversation-turn-2",
      artifactRef: "artifact:text",
      rawDomHash: hash("raw-dom"),
      semanticTextHash: hash("wrong-predecessor-response"),
      canonicalConversationUrl: conversationUrl,
      promptHash: predecessorPromptHash,
      turnMarker: predecessorMarker,
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
