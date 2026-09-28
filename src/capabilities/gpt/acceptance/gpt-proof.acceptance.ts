import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { executionFailure } from "../../../lib/execution-failure.js";

import { buildGptExecutionProfile } from "../index.js";
import {
  GPT_MODEL_SELECTOR_OPENABLE_ENTRY,
} from "../children/open_gpt_model_selector_v3/selectors.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { executeProductionGptAtomicCall } from "../production-atomic-call.js";
import { failedGptChildExecutionResult } from "../ability-group.js";
import type { ProductionGptBrowserCall } from "../production-browser-lifecycle.js";
import { conversationUrl, promptHash } from "./gpt-conversation-fixture.js";
import { verifyStoppedEmptyRecoveryContract } from "./gpt-stopped-empty.acceptance-support.js";
import { verifyGeneratedImageEvidenceBoundary } from "./gpt-generated-image-evidence.acceptance-support.js";
import { verifySubmitProofs } from "./gpt-proof-submit.acceptance-support.js";
import { verifyKnownRateLimitClosure } from "./gpt-rate-limit-closure.acceptance-support.js";
import {
  coherentObservationPacket,
  exactAssistantTurnReply,
  fakeBrowser,
} from "./gpt-exact-target-browser-fixture.js";

const profile = buildGptExecutionProfile({
  profileRef: "acceptance:proof-profile",
  startModelDisplayName: "GPT-5.6 Sol",
  requestedReasoningValue: 5,
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-proof",
  acceptanceVersion: "v1",
});

verifyStoppedEmptyRecoveryContract();

const modelFacts = (open: boolean) => ({
  "openable-entry": { rawCount: open ? 0 : 1, eligibleCount: open ? 0 : 1 },
  "specified-model": { rawCount: 2, eligibleCount: open ? 1 : 0 },
});

const doneHarness = createGptAcceptanceHarness("gpt-proof-done");
const doneFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(true));
  throw new Error(`UNEXPECTED_DONE_PROOF_INTENT:${intent.kind}`);
});
const done = await doneHarness.execute("open_gpt_model_selector_v3", doneFixture.browser, { profile });
assert.equal(done.status, "success", done.failureCode ?? "DONE proof failed");
assert.equal(done.proof.internalDecisionCode, "DONE");
assert.deepEqual(done.proof.candidateCardinality, { raw: 2, eligible: 1 },
  "GPT selector DONE is proved by the exact visible model option");
assert.equal(done.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
assert.equal(done.proof.committedMutation, "no");
assert.equal(done.proof.browserFact, null);

{
  const mismatchHarness = createGptAcceptanceHarness("gpt-proof-dialog-mismatch");
  const intent = mismatchHarness.buildIntent("open_gpt_model_selector_v3", { profile });
  const evidenceRef = "browser-gpt-dialog-unrecognized|2026-09-21T00:00:00.000Z";
  const evidenceHash = `sha256:${"d".repeat(64)}` as const;
  const failed = await failedGptChildExecutionResult({
    intent,
    context: { dataDir: "/tmp/gpt-dialog-mismatch" },
    startedAt: "2026-09-21T00:00:00.000Z",
    error: executionFailure("failed", "BROWSER_GPT_DIALOG_UNRECOGNIZED", {
      metadata: { mutationOutcome: "no", evidence: { evidenceRef, evidenceHash } },
    }),
  });
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureCode, "BROWSER_GPT_DIALOG_UNRECOGNIZED");
  assert.equal(failed.proof.browserFact, null,
    "a code and generic evidence without the complete Browser fact must not forge the mismatch exception");
  assert.equal(failed.proof.committedMutation, "no");
}

await verifyKnownRateLimitClosure(profile);

let open = false;
const actHarness = createGptAcceptanceHarness("gpt-proof-act");
const actFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(open));
  if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTOR_OPENABLE_ENTRY) {
    open = true;
    return { postconditionVerified: true,
      postconditionRawCount: 2, postconditionEligibleCount: 1 };
  }
  throw new Error(`UNEXPECTED_ACT_PROOF_INTENT:${intent.kind}`);
});
const acted = await actHarness.execute("open_gpt_model_selector_v3", actFixture.browser, { profile });
assert.equal(acted.status, "success", acted.failureCode ?? "ACT proof failed");
assert.equal(acted.proof.internalDecisionCode, "ACT");
assert.equal(acted.proof.committedMutation, "confirmed");
assert.equal(acted.proof.browserFact?.browserOutcome, "CONFIRMED");
assert.equal(acted.proof.browserFact?.mutationOutcome, "confirmed");
assert.equal(acted.proof.browserFact?.childCapabilityId, "open_gpt_model_selector_v3");
assert.equal(acted.proof.browserFact?.evidenceHash, `sha256:${"9".repeat(64)}`);
assert.equal(JSON.stringify(acted.proof).includes(profile.startModelDisplayName), false,
  "proof must contain only hashes, refs, cardinality and typed facts, never sensitive UI text");

let zeroActionOpened = false;
const zeroActionFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(zeroActionOpened));
  if (intent.kind === "click") {
    zeroActionOpened = true;
    return { mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true,
      postconditionRawCount: 2, postconditionEligibleCount: 1 };
  }
  throw new Error(`UNEXPECTED_ZERO_ACTION_MODEL_INTENT:${intent.kind}`);
});
const zeroActionResult = await createGptAcceptanceHarness("gpt-proof-zero-action-scope")
  .execute("open_gpt_model_selector_v3", zeroActionFixture.browser, { profile });
assert.equal(zeroActionResult.status, "success", zeroActionResult.failureCode ?? "zero-action proof failed");
assert.equal(zeroActionResult.value?.state, "model-selector-open");
assert.equal(zeroActionResult.proof.internalDecisionCode, "DONE");
assert.equal(zeroActionResult.proof.committedMutation, "no");
assert.equal(zeroActionResult.proof.browserFact?.browserOutcome, "CONFIRMED");
assert.equal(zeroActionResult.proof.browserFact?.mutationOutcome, "no",
  "the exact model-selector open Child may settle without a click when its direct postcondition already holds");
assert.equal(zeroActionFixture.physicalMutations(), 0);

const stableHarnessOne = createGptAcceptanceHarness("gpt-proof-stable");
const stableHarnessTwo = createGptAcceptanceHarness("gpt-proof-stable");
const stableFixture = () => fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(true));
  throw new Error(`UNEXPECTED_STABLE_PROOF_INTENT:${intent.kind}`);
});
const stableOne = await stableHarnessOne.execute("open_gpt_model_selector_v3", stableFixture().browser, { profile });
const stableTwo = await stableHarnessTwo.execute("open_gpt_model_selector_v3", stableFixture().browser, { profile });
assert.equal(stableOne.proof.evidenceHash, stableTwo.proof.evidenceHash,
  "same exact call and same facts must produce one stable proof hash");

await verifySubmitProofs();

await verifyGeneratedImageEvidenceBoundary();

for (const priorState of ["rejected", "dispatched"] as const) {
  const incidentSuffix = priorState === "rejected" ? "3" : "4";
  const acknowledgementInput = {
    incidentRequestId: `aipcooldown_${incidentSuffix.repeat(40)}`,
    dialogHash: "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15" as const,
    observationHash: `sha256:${"5".repeat(64)}` as const,
    targetRefHash: `sha256:${"6".repeat(64)}` as const,
    documentRefHash: `sha256:${"7".repeat(64)}` as const,
    observedAt: new Date(Date.now() - 5_000).toISOString(),
  };
  const priorOutcome = {
    state: priorState,
    mutationOutcome: priorState === "rejected" ? "no" as const : "dispatched" as const,
    providerEffectIdentityHash: null,
    terminalAt: priorState === "rejected" ? new Date().toISOString() : null,
    failureCode: priorState === "rejected" ? "BROWSER_RATE_LIMIT_ACK_REJECTED" : null,
    nativeFailureCode: null,
    authorityRef: `browser-mutation:rate-limit-${priorState}`,
    authorityHash: `sha256:${"8".repeat(64)}` as const,
    targetRef: "target:1", documentRef: "document:1", physicalInputCount: 0 as const,
    downloadGuidHash: null, downloadCompleted: false, identityRevalidated: true,
  };
  const fixture = fakeBrowser((intent) => {
    assert.equal(intent.kind, "readKnownGptRateLimitClearance",
      "terminal ACK recovery may perform only the dedicated read-only clearance observation");
    return {
      schemaVersion: "grasseye.browser.known-gpt-rate-limit-clearance.v1",
      state: "confirmed_absent", dialogHash: acknowledgementInput.dialogHash,
      targetRefHash: acknowledgementInput.targetRefHash,
      documentRefHash: acknowledgementInput.documentRefHash,
      observationHash: `sha256:${"9".repeat(64)}`,
      observedAt: new Date().toISOString(), candidateCount: 0,
      identityRevalidated: true, mutationCount: 0,
      postconditionVerified: true, zeroActionSatisfied: true,
    };
  }, { initialRecovery: priorOutcome, exposeInitialRecoveryOutsideAtomic: true });
  const harness = createGptAcceptanceHarness(`gpt-proof-terminal-${priorState}-rate-limit-ack`);
  const intent = harness.buildIntent("acknowledge_known_gpt_rate_limit", acknowledgementInput);
  const browserCall: ProductionGptBrowserCall = {
    browser: fixture.browser, facade: fixture.browser, providerWaitLog: null,
    confirmedProviderEffect: null, settledResultPayloadHash: null,
    recoverySelectionRequired: false,
  };
  const recovered = await executeProductionGptAtomicCall({
    dataDir: "/tmp/gpt-exact-target", gpt: harness.gpt, browsers: {} as never,
    intent, browserCall, signal: new AbortController().signal, resultRevision: 0,
  });
  assert.equal(recovered.status, "success",
    recovered.failureCode ?? `${priorState} ACK clearance recovery failed`);
  assert.equal(Reflect.get(recovered.value ?? {}, "clearance"), "confirmed_absent");
  assert.equal(recovered.proof.browserFact?.mutationOutcome, "no");
  assert.equal(fixture.physicalMutations(), 0,
    `${priorState} ACK recovery must never replay a physical acknowledgement input`);
}

{
  const fixture = fakeBrowser((intent) => {
    throw new Error(`RECOVERED_SUBMIT_MUST_NOT_TOUCH_BROWSER:${intent.kind}`);
  }, { initialUrl: conversationUrl });
  const terminalPayload = {
    canonicalConversationUrl: conversationUrl,
    promptHash,
    userTurnId: "00000000-0000-4000-8000-000000000003",
    exactCallIdentityHash: `sha256:${"1".repeat(64)}`,
    observationRevisionHash: `sha256:${"2".repeat(64)}`,
    targetRefHash: `sha256:${"3".repeat(64)}`,
    documentRefHash: `sha256:${"4".repeat(64)}`,
    rawCount: 1,
    eligibleCount: 1,
  };
  const result = await createGptAcceptanceHarness("gpt-proof-recovered-submit").execute(
    "submit_exact_gpt_turn_once", fixture.browser, { files: [], promptHash }, {
      confirmedProviderEffectReadback: {
        terminalPayload, terminalAt: "2026-09-02T00:00:01.000Z",
        authorityRef: "browser-mutation:recovered", authorityHash: `sha256:${"9".repeat(64)}`,
        providerEffectIdentityHash: `sha256:${"8".repeat(64)}`,
        mutationOutcome: "confirmed",
      },
    },
  );
  assert.equal(result.status, "success", result.failureCode ?? "recovered submit failed");
  assert.equal(result.value?.userTurnId, "00000000-0000-4000-8000-000000000003");
  assert.equal(fixture.physicalMutations(), 0);

  const temporaryRoute = await createGptAcceptanceHarness("gpt-proof-recovered-temporary-route").execute(
    "submit_exact_gpt_turn_once", fixture.browser, { files: [], promptHash }, {
      confirmedProviderEffectReadback: {
        terminalPayload: { ...terminalPayload,
          canonicalConversationUrl: "https://chatgpt.com/c/WEB:temporary-client-route" },
        terminalAt: "2026-09-02T00:00:01.000Z",
        authorityRef: "browser-mutation:temporary-route", authorityHash: `sha256:${"9".repeat(64)}`,
        providerEffectIdentityHash: `sha256:${"8".repeat(64)}`,
        mutationOutcome: "confirmed",
      },
    },
  );
  assert.equal(temporaryRoute.status, "failed");
  assert.equal(temporaryRoute.failureCode, "GPT_CONFIRMED_SUBMIT_READBACK_INVALID");
  assert.equal(fixture.physicalMutations(), 0,
    "a historical temporary route must fail before Browser navigation or Provider replay");
}

for (const promptMatches of [true, false]) {
  const dispatched = {
    state: "dispatched" as const, mutationOutcome: "dispatched" as const,
    providerEffectIdentityHash: `sha256:${"8".repeat(64)}` as const, terminalAt: null,
    failureCode: null, nativeFailureCode: null, authorityRef: "browser-mutation:dispatched-submit",
    authorityHash: `sha256:${"9".repeat(64)}` as const, targetRef: "target:1",
    documentRef: "document:1", physicalInputCount: 0 as const, downloadGuidHash: null,
    downloadCompleted: false, identityRevalidated: false,
  };
  const fixture = fakeBrowser((intent) => {
    assert.equal(intent.kind, "observe", "DISPATCHED submit recovery must be observation-only");
    return coherentObservationPacket({ queries: intent.kind === "observe" ? intent.queries : [] }, {
      "submitted-user-turn": { rawCount: 1, eligibleCount: 1, matches: [{
        turnKey: "00000000-0000-4000-8000-000000000009", exactGptUserPromptHash: promptMatches
          ? promptHash : `sha256:${"f".repeat(64)}`,
      }] }, "empty-composer": { rawCount: 1, eligibleCount: 1, matches: [{}] },
    }, conversationUrl);
  }, { initialRecovery: dispatched, initialPending: 1, exposeInitialRecoveryOutsideAtomic: true });
  const harness = createGptAcceptanceHarness(`gpt-proof-dispatched-submit-${promptMatches}`);
  const intent = harness.buildIntent("submit_exact_gpt_turn_once", { files: [], promptHash });
  const browserCall: ProductionGptBrowserCall = { browser: fixture.browser, facade: fixture.browser,
    providerWaitLog: null, confirmedProviderEffect: null, settledResultPayloadHash: null,
    recoverySelectionRequired: false };
  await assert.rejects(executeProductionGptAtomicCall({ dataDir: "/tmp/gpt-exact-target",
    gpt: harness.gpt, browsers: {} as never, intent, browserCall,
    signal: new AbortController().signal, resultRevision: 0 }),
  /GPT_ATOMIC_STEP_ALREADY_ATTEMPTED/u);
  assert.equal(fixture.physicalMutations(), 0, "DISPATCHED submit readback must never resend");
}

{
  const acknowledgementReceipt = {
    clicked: true, candidateCount: 1, identityRevalidated: true, mutationCount: 1,
    postconditionVerified: true,
  };
  const recovery = {
    state: "confirmed" as const, mutationOutcome: "confirmed" as const,
    providerEffectIdentityHash: null, terminalAt: new Date().toISOString(),
    failureCode: null, nativeFailureCode: null, authorityRef: "browser-mutation:cooldown-ack",
    authorityHash: `sha256:${"7".repeat(64)}` as const, targetRef: "target:1",
    documentRef: "document:1", physicalInputCount: 1 as const,
    downloadGuidHash: null, downloadCompleted: false, identityRevalidated: true,
    terminalPayload: acknowledgementReceipt,
  };
  const fixture = fakeBrowser((intent) => {
    throw new Error(`RECOVERED_ACK_MUST_NOT_TOUCH_BROWSER:${intent.kind}`);
  }, { initialRecovery: recovery });
  const result = await createGptAcceptanceHarness("gpt-proof-recovered-rate-limit-ack").execute(
    "acknowledge_known_gpt_rate_limit", fixture.browser, {
      incidentRequestId: `aipcooldown_${"1".repeat(40)}`,
      dialogHash: "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15",
      observationHash: `sha256:${"2".repeat(64)}`,
      targetRefHash: `sha256:${"3".repeat(64)}`,
      documentRefHash: `sha256:${"4".repeat(64)}`,
      observedAt: new Date(Date.now() - 5_000).toISOString(),
    }, { confirmedRateLimitAcknowledgementReadback: { terminalPayload: acknowledgementReceipt } });
  assert.equal(result.status, "success", result.failureCode ?? "durable ack WAL recovery failed");
  assert.equal(result.value?.clearance, "confirmed_absent");
  assert.equal(fixture.physicalMutations(), 0,
    "a recovered durable acknowledgement must not click the Provider a second time");

  const vanishedDialogFixture = fakeBrowser((intent) => {
    assert.equal(intent.kind, "acknowledgeKnownGptRateLimit");
    return { candidateCount: 0, identityRevalidated: true, mutationCount: 0,
      postconditionVerified: true, zeroActionSatisfied: true };
  });
  const vanishedDialog = await createGptAcceptanceHarness(
    "gpt-proof-vanished-rate-limit-ack",
  ).execute("acknowledge_known_gpt_rate_limit", vanishedDialogFixture.browser, {
    incidentRequestId: `aipcooldown_${"2".repeat(40)}`,
    dialogHash: "sha256:084b621b91e3affcf2199269157febb07ded1b7a3287ac61104108317cddde15",
    observationHash: `sha256:${"3".repeat(64)}`,
    targetRefHash: `sha256:${"4".repeat(64)}`,
    documentRefHash: `sha256:${"5".repeat(64)}`,
    observedAt: new Date(Date.now() - 5_000).toISOString(),
  });
  assert.equal(vanishedDialog.status, "success",
    vanishedDialog.failureCode ?? "zero-click absence readback failed");
  assert.equal(vanishedDialog.value?.clearance, "confirmed_absent");
  assert.equal(vanishedDialogFixture.physicalMutations(), 0,
    "an already absent exact dialog must close by zero-click readback");
}

{
  const userTurnId = "00000000-0000-4000-8000-000000000001";
  const assistantTurnId = "00000000-0000-4000-8000-000000000004";
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "readExactAssistantTurn") {
      assert.equal(intent.turnMarker, "exact");
      return exactAssistantTurnReply(intent, "exact response");
    }
    throw new Error(`UNEXPECTED_EXACT_CHECKPOINT_INTENT:${intent.kind}`);
  }, { initialUrl: conversationUrl });
  const waitReasons: string[] = [];
  const result = await createGptAcceptanceHarness("gpt-proof-exact-checkpoint").execute(
    "checkpoint_gpt_text_response", fixture.browser,
    { canonicalConversationUrl: conversationUrl,
      probeBudgetMs: 200_000, userTurnId, turnMarker: "exact" }, {
      waitForProviderObservation: async (_deadline, reason) => {
        waitReasons.push(reason);
        return "reobserve";
      },
    },
  );
  assert.equal(result.status, "success", result.failureCode ?? "exact checkpoint failed");
  assert.equal(waitReasons.length, 1,
    "the first exact checkpoint must pass through the Provider observation gate");
  assert.deepEqual(waitReasons, ["initial-observation"]);
  assert.equal(result.value?.assistantTurnId, assistantTurnId);
  assert.equal(result.value?.semanticText, "exact response");
  assert.equal(fixture.physicalMutations(), 0,
    "a confirmed submit UUID may drift from the current marker turn without another Provider input");
}

{
  const fixture = fakeBrowser((intent) => {
    if (intent.kind !== "readExactAssistantTurn") throw new Error("UNEXPECTED_EXACT_CHECKPOINT_INTENT");
    return { ...exactAssistantTurnReply(intent, "wrong conversation"),
      currentUrl: new URL("/c/another-conversation", conversationUrl).href };
  }, { initialUrl: conversationUrl });
  const result = await createGptAcceptanceHarness("gpt-proof-exact-wrong-url").execute(
    "checkpoint_gpt_text_response", fixture.browser,
    { canonicalConversationUrl: conversationUrl, probeBudgetMs: 200_000,
      userTurnId: "00000000-0000-4000-8000-000000000003", turnMarker: "exact" }, {
      waitForProviderObservation: async () => "reobserve",
    },
  );
  assert.equal(result.failureCode, "GPT_EXACT_ASSISTANT_TURN_RESULT_INVALID");
}

{
  const userTurnId = "00000000-0000-4000-8000-000000000003";
  let responseReadCount = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind !== "readExactAssistantTurn") {
      throw new Error(`UNEXPECTED_LONG_RESPONSE_INTENT:${intent.kind}`);
    }
    responseReadCount += 1;
    const reply = exactAssistantTurnReply(intent, responseReadCount === 1 ? "partial" : "complete");
    return responseReadCount === 1 ? { ...reply, generatingRaw: 1 } : reply;
  }, { initialUrl: conversationUrl });
  const waitReasons: string[] = [];
  const result = await createGptAcceptanceHarness("gpt-proof-stop-survives-deadline").execute(
    "checkpoint_gpt_text_response", fixture.browser,
    { canonicalConversationUrl: conversationUrl,
      probeBudgetMs: 1, userTurnId, turnMarker: "exact" }, {
      waitForProviderObservation: async (_deadline, reason) => {
        waitReasons.push(reason);
        if (waitReasons.length === 1) await new Promise((resolve) => setTimeout(resolve, 5));
        return waitReasons.length === 2 ? "deadline" : "reobserve";
      },
    },
  );
  assert.equal(result.status, "success", result.failureCode ?? "long response was cut off by deadline");
  assert.equal(result.value?.semanticText, "complete");
  assert.deepEqual(waitReasons, ["initial-observation", "stop-present", "stop-present"]);
  assert.equal(waitReasons.length, 3,
    "a stop-present exact response must remain pending across the original probe deadline");
  assert.equal(responseReadCount, 2,
    "a deadline gate result must not read the Provider response");
}

{
  const userTurnId = "00000000-0000-4000-8000-000000000003";
  let responseReadCount = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind !== "readExactAssistantTurn") {
      throw new Error(`UNEXPECTED_WAIT_REASON_INTENT:${intent.kind}`);
    }
    responseReadCount += 1;
    if (responseReadCount === 1) {
      throw executionFailure("failed", "BROWSER_EXACT_USER_TURN_UNAVAILABLE");
    }
    if (responseReadCount === 2) {
      throw executionFailure("failed", "BROWSER_ADJACENT_ASSISTANT_TURN_MISSING");
    }
    if (responseReadCount === 3) return exactAssistantTurnReply(intent, "");
    return exactAssistantTurnReply(intent, "complete");
  }, { initialUrl: conversationUrl });
  const waitReasons: string[] = [];
  const result = await createGptAcceptanceHarness("gpt-proof-wait-reasons").execute(
    "checkpoint_gpt_text_response", fixture.browser,
    { canonicalConversationUrl: conversationUrl,
      probeBudgetMs: 200_000, userTurnId, turnMarker: "exact" }, {
      waitForProviderObservation: async (_deadline, reason) => {
        waitReasons.push(reason);
        return "reobserve";
      },
    },
  );
  assert.equal(result.status, "success", result.failureCode ?? "wait reasons failed");
  assert.deepEqual(waitReasons, [
    "initial-observation",
    "exact-user-turn-unavailable",
    "adjacent-assistant-missing",
    "stopped-empty-confirming",
  ]);
}
