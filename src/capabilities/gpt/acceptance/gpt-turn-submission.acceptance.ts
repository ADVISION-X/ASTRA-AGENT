import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { executionFailure } from "../../../lib/execution-failure.js";
import { exerciseConfirmedSubmitFailureEvidenceReadback } from
  "./gpt-failure-evidence-readback.acceptance-support.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import {
  EMPTY_HASH,
  approvedFile,
  conversationUrl,
  draftFacts,
  freshHarness,
  hash,
  marker,
  prompt,
  promptHash,
} from "./gpt-conversation-fixture.js";

{
  const { execute } = freshHarness();
  let currentHash = EMPTY_HASH;
  let simulatedNow = 0;
  let postFillObservations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      if (currentHash === promptHash) postFillObservations += 1;
      const settledHash = currentHash === promptHash && postFillObservations === 1
        ? EMPTY_HASH : currentHash;
      return coherentObservationPacket(intent, draftFacts({ composerHash: settledHash }), "https://chatgpt.com/");
    }
    if (intent.kind === "fill") {
      assert.equal(intent.approvedText, prompt);
      currentHash = promptHash;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_PROMPT_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("write_exact_gpt_prompt", fixture.browser, { prompt });
    assert.equal(result.status, "success", result.failureCode ?? "prompt write failed");
    assert.equal(result.value?.hash, promptHash);
    assert.equal(fixture.waitDurations().reduce((sum, duration) => sum + duration, 0), 125,
      "a transient post-fill readback must settle inside the shared 2500ms window");
    assert.equal(fixture.physicalMutations(), 1);
  } finally {
    Date.now = nativeDateNow;
  }
}

{
  const { execute } = freshHarness();
  const mismatchedHash = hash("provider rendered a different retained value");
  let filled = false;
  let simulatedNow = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, draftFacts({
        composerHash: filled ? mismatchedHash : EMPTY_HASH,
      }), "https://chatgpt.com/");
    }
    if (intent.kind === "fill") {
      filled = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_PROMPT_MISMATCH_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("write_exact_gpt_prompt", fixture.browser, { prompt });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "GPT_PROMPT_WRITE_UNCONFIRMED");
    assert.equal(result.proof.committedMutation, "confirmed");
    assert.equal(result.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
    assert.ok(result.proof.factResultIds.includes(`gpt-composer-expected-hash:${promptHash.slice(7)}`));
    assert.ok(result.proof.factResultIds.includes(`gpt-composer-observed-hash:${mismatchedHash.slice(7)}`));
    assert.equal(simulatedNow, 2_500,
      "a persistent post-fill mismatch must consume exactly the shared settlement ceiling");
    assert.equal(fixture.physicalMutations(), 1,
      "a confirmed fill with mismatched exact readback must fail closed without a second mutation");
  } finally {
    Date.now = nativeDateNow;
  }
}

{
  const { execute } = freshHarness();
  const mismatchedHash = hash("initial transient mismatch");
  let filled = false;
  let postFillReads = 0;
  let simulatedNow = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      if (!filled) return coherentObservationPacket(intent, draftFacts({ composerHash: EMPTY_HASH }));
      postFillReads += 1;
      if (postFillReads === 1) {
        return coherentObservationPacket(intent, draftFacts({ composerHash: mismatchedHash }));
      }
      throw executionFailure("failed", "BROWSER_DOM_NODE_STALE");
    }
    if (intent.kind === "fill") {
      filled = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_PROMPT_STALE_SETTLEMENT_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("write_exact_gpt_prompt", fixture.browser, { prompt });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "BROWSER_DOM_NODE_STALE",
      "the latest native observation failure must not be masked by an older semantic mismatch");
    assert.equal(simulatedNow, 2_500);
    assert.equal(fixture.physicalMutations(), 1);
  } finally {
    Date.now = nativeDateNow;
  }
}

{
  const { execute } = freshHarness();
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      const attachmentQuery = intent.queries.find((query) => query.queryId === "attachment-items");
      assert.deepEqual(attachmentQuery?.scope, { selector: "form:has(#prompt-textarea)" },
        "draft attachment readback must be scoped to the exact Composer form");
      return coherentObservationPacket(intent, draftFacts({
        composerHash: promptHash, attachment: true, sendDisabled: true,
      }));
    }
    throw new Error(`UNEXPECTED_DRAFT_INTENT:${intent.kind}`);
  });
  const result = await execute("reconcile_gpt_draft", fixture.browser, {
    files: [approvedFile], prompt, turnMarker: marker,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_DRAFT_OR_SEND_READBACK_MISMATCH");
  assert.equal(observations, 1, "pure draft observation must not consume the mutation settlement window");
  assert.equal(fixture.waitDurations().length, 0);
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { execute } = freshHarness();
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent, draftFacts({
        composerHash: observations === 1 ? promptHash : EMPTY_HASH,
        attachment: true,
      }));
    }
    throw new Error(`UNSTABLE_DRAFT_MUST_NOT_MUTATE:${intent.kind}`);
  });
  const result = await execute("reconcile_gpt_draft", fixture.browser, {
    files: [approvedFile], prompt, turnMarker: marker,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_DRAFT_READBACK_UNSTABLE");
  assert.equal(observations, 2, "a semantically valid first draft read must be confirmed by one fresh read");
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { execute } = freshHarness();
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent, draftFacts({ composerHash: promptHash, attachment: true }));
    }
    throw new Error(`STABLE_DRAFT_MUST_NOT_MUTATE:${intent.kind}`);
  });
  const result = await execute("reconcile_gpt_draft", fixture.browser, {
    files: [approvedFile], prompt, turnMarker: marker,
  });
  assert.equal(result.status, "success", result.failureCode ?? "stable draft failed");
  assert.equal(observations, 2);
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
        attachment: !submitted,
      }), submitted ? conversationUrl : "https://chatgpt.com/");
    }
    if (intent.kind === "click") {
      assert.equal(intent.postClickMatch?.timeoutMs, 5_000,
        "Browser must own the single bounded outer-turn hydration postcondition");
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
  assert.equal(fixture.waitDurations().length, 0,
    "submit must not append a second GPT settlement chain after Browser's bounded postcondition");
  assert.equal(fixture.physicalMutations(), 1);

  const confirmedProviderSubmitReceipt = Object.freeze({
    sourceAttemptId: "attempt:gpt-exact-target",
    sourceExactCallIdentityHash: `sha256:${"a".repeat(64)}` as const,
    sourceActionOrdinal: 1,
    sourceProductStepId: "acceptance:gpt-browser-handoff",
    sourceCallId: "acceptance-call",
    sourceTargetRef: "target:1",
    sourceDocumentRef: "document:1",
    sourceTerminalAt: "2026-09-02T00:00:01.000Z",
    evidenceRef: "evidence:submit",
    evidenceHash: `sha256:${"b".repeat(64)}` as const,
    promptHash,
    turnMarker: marker,
  });
  const mismatchedReceipt = await execute("reconcile_gpt_turn_submission", fixture.browser, {
    expectedPromptHash: promptHash, timeoutMs: 1_000, turnMarker: marker,
  }, undefined, { confirmedProviderSubmitReceipt: {
    ...confirmedProviderSubmitReceipt, turnMarker: "[GRASSEYE:wrong-submit]",
  } });
  assert.equal(mismatchedReceipt.status, "failed");
  assert.equal(mismatchedReceipt.failureCode, "GPT_CONFIRMED_SUBMIT_RECEIPT_MISMATCH");
  const reconciled = await execute("reconcile_gpt_turn_submission", fixture.browser, {
    expectedPromptHash: promptHash, timeoutMs: 1_000, turnMarker: marker,
  }, undefined, { confirmedProviderSubmitReceipt });
  assert.equal(reconciled.status, "success", reconciled.failureCode ?? "submission reconciliation failed");
  assert.equal(reconciled.value?.canonicalConversationUrl, conversationUrl);
  assert.equal(fixture.physicalMutations(), 1, "readback must not submit again");
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, draftFacts({
      composerHash: promptHash, submitted: true, attachment: true,
    }), conversationUrl);
    throw new Error(`DIRTY_ALREADY_SUBMITTED_STATE_MUST_NOT_MUTATE:${intent.kind}`);
  });
  const result = await execute("submit_exact_gpt_turn_once", fixture.browser, {
    files: [approvedFile], promptHash, turnMarker: marker,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_SUBMIT_EXISTING_TURN_POSTCONDITION_INVALID");
  assert.equal(fixture.physicalMutations(), 0,
    "an existing matching turn with draft or attachment residue must not be accepted or resubmitted");
}

{
  const { execute } = freshHarness();
  let clicked = false;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, draftFacts({
        composerHash: promptHash,
        submitted: false,
        attachment: !clicked,
      }), "https://chatgpt.com/");
    }
    if (intent.kind === "click") {
      assert.equal(intent.postClickMatch?.timeoutMs, 5_000);
      clicked = true;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_SUBMIT_TIMEOUT_INTENT:${intent.kind}`);
  });
  const input = Object.freeze({ files: [approvedFile], promptHash, turnMarker: marker });
  const result = await execute("submit_exact_gpt_turn_once", fixture.browser, input);
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_TURN_SUBMISSION_POSTCONDITION_FAILED");
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(result.proof.browserFact?.browserOutcome, "CONFIRMED");
  assert.equal(fixture.waitDurations().length, 0,
    "submit semantic mismatch must not create a second post-mutation wait chain");
  assert.equal(fixture.physicalMutations(), 1,
    "semantic readback failure must never repeat the Provider submit mutation");
  await exerciseConfirmedSubmitFailureEvidenceReadback(result, input);
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      const attachmentQuery = intent.queries.find((query) => query.queryId === "attachment-items");
      assert.deepEqual(attachmentQuery?.scope, { selector: "form:has(#prompt-textarea)" });
      return coherentObservationPacket(intent, draftFacts({
        composerHash: promptHash, attachment: false,
      }), "https://chatgpt.com/");
    }
    throw new Error(`SUBMIT_WITHOUT_ATTACHMENT_MUST_NOT_MUTATE:${intent.kind}`);
  });
  const result = await execute("submit_exact_gpt_turn_once", fixture.browser, {
    files: [approvedFile], promptHash, turnMarker: marker,
  });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_SUBMIT_PRECONDITION_INVALID");
  assert.equal(fixture.physicalMutations(), 0,
    "an attachment that disappears after draft reconciliation must block submit without clicking");
}

{
  const { execute } = freshHarness();
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, draftFacts({ composerHash: "not-a-sha256" }));
    }
    throw new Error(`INVALID_COMPOSER_HASH_MUST_NOT_MUTATE:${intent.kind}`);
  });
  const result = await execute("write_exact_gpt_prompt", fixture.browser, { prompt });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_DOM_RESULT_INVALID");
  assert.equal(fixture.physicalMutations(), 0);
}
