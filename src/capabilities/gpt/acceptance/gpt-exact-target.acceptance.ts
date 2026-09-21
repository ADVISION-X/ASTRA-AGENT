import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { GPT_CHILD_CAPABILITY_CONTRACTS } from "../contract.js";
import { GPT_PROFILE_TRIGGER_SELECTOR } from "./gpt-page-fixture-selectors.js";
import {
  coherentObservationPacket,
  EXPECTED_GPT_CHILD_IDS,
  fakeBrowser,
} from "./gpt-exact-target-browser-fixture.js";
import { assertGptExactTargetSourceShape } from "./gpt-exact-target-source-support.js";
import {
  exercisePreExecutionFailureEvidence,
} from "./gpt-failure-evidence-readback.acceptance-support.js";
import { conversationFacts } from "./gpt-exact-target-conversation-fixture.js";
import { exerciseExactModelSelection } from "./gpt-exact-target-model.acceptance-support.js";
import {
  execute,
  exerciseTransientProfileConfirmations,
  profile,
  profileFacts,
} from "./gpt-exact-target-profile-fixture.js";
import "./gpt-reasoning-requirement.acceptance.js";

assert.deepEqual(Object.keys(GPT_CHILD_CAPABILITY_CONTRACTS).sort(), EXPECTED_GPT_CHILD_IDS);
assert.equal(Object.keys(GPT_CHILD_CAPABILITY_CONTRACTS).length, 14);
assertGptExactTargetSourceShape(import.meta.url);


{
  let simulatedNow = 0;
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent,
        conversationFacts(observations < 3 ? null : ""));
    }
    throw new Error(`PREPARE_HYDRATION_MUST_NOT_ACT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60_000 });
    assert.equal(result.status, "success", result.failureCode ?? "prepare hydration failed");
    assert.equal(observations, 3);
    assert.deepEqual(fixture.waitDurations(), [1_500, 3_000],
      "prepare must use the one typed transient-DOM confirmation cadence");
    assert.equal(fixture.physicalMutations(), 0);
  } finally {
    Date.now = nativeDateNow;
  }
}

for (const [field, failureCode] of [
  ["user", "GPT_CHAT_PRIOR_USER_TURN_PRESENT"],
  ["assistant", "GPT_CHAT_PRIOR_ASSISTANT_TURN_PRESENT"],
  ["attachments", "GPT_CHAT_ATTACHMENT_PRESENT"],
  ["generating", "GPT_CHAT_GENERATION_PRESENT"],
] as const) {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, conversationFacts("", { [field]: 1 }));
    }
    throw new Error(`DIRTY_CHAT_MUST_NOT_ACT:${field}:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, failureCode);
  assert.deepEqual(fixture.waitDurations(), [], `${field} must fail on the first observation`);
  assert.equal(fixture.physicalMutations(), 0);
}

{
  let cleared = false;
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent, conversationFacts(cleared ? "" : "stale draft"));
    }
    if (intent.kind === "fill") {
      cleared = true;
      return {};
    }
    throw new Error(`UNEXPECTED_DRAFT_CLEAR_INTENT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60_000 });
  assert.equal(result.status, "success", result.failureCode ?? "draft clear failed");
  assert.equal(result.value?.staleDraftCleared, true);
  assert.equal(observations, 2, "an isolated stale draft must be cleared once and reread once");
  assert.deepEqual(fixture.waitDurations(), []);
  assert.equal(fixture.physicalMutations(), 1);
}

{
  let mode: "chat" | "work" = "work";
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, conversationFacts("", { mode }));
    if (intent.kind === "click") {
      assert.equal(intent.expectedTextEquals, undefined);
      assert.match(intent.selector, /data-tpp-toggle-value='chatgpt'/u);
      assert.deepEqual(intent.postClickObservation?.queries.map((query) => [
        query.queryId, query.expectedEligibleCount, query.fields,
      ]), [
        ["chat-mode", 1, ["ariaChecked"]], ["work-mode", 1, ["ariaChecked"]],
      ]);
      mode = "chat";
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        clickedCandidateAttributeReadback: { name: "aria-checked", value: "true", verified: true },
        postconditionObservation: coherentObservationPacket({ queries }, conversationFacts("", { mode })),
      };
    }
    throw new Error(`WORK_TO_CHAT_MUST_ONLY_CLICK:${intent.kind}`);
  }, { enforceClickedAttributeReadback: true });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60_000 });
  assert.equal(result.status, "success", result.failureCode ?? "work-to-chat failed");
  assert.equal(result.value?.staleDraftCleared, false);
  assert.equal(fixture.physicalMutations(), 1);
}

for (const failure of ["wrong-attribute", "postcondition-not-chat"] as const) {
  let mode: "chat" | "work" = "work";
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, conversationFacts("", { mode }));
    if (intent.kind === "click") {
      mode = failure === "postcondition-not-chat" ? "work" : "chat";
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        clickedCandidateAttributeReadback: failure === "wrong-attribute"
          ? { name: "aria-checked", value: "false", verified: false }
          : { name: "aria-checked", value: "true", verified: true },
        postconditionObservation: coherentObservationPacket({ queries }, conversationFacts("", { mode })),
      };
    }
    throw new Error(`WORK_TO_CHAT_FAILURE_MUST_NOT_REACT:${intent.kind}`);
  }, { enforceClickedAttributeReadback: true });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, failure === "wrong-attribute"
    ? "BROWSER_AUTH_TRANSCRIPT_INVALID" : "GPT_CHAT_MODE_SELECTION_POSTCONDITION_INVALID");
  assert.equal(fixture.physicalMutations(), failure === "wrong-attribute" ? 0 : 1);
}

for (const [overrides, code, waits] of [
  [{ chatModeRaw: 0 }, "GPT_CHAT_MODE_MISSING", [1_500, 3_000]],
  [{ chatModeRaw: 2, chatModeEligible: 2 }, "GPT_CHAT_MODE_AMBIGUOUS", []],
  [{ chatModeEligible: 0 }, "GPT_CHAT_MODE_NOT_ACTIONABLE", [1_500, 3_000]],
  [{ workModeRaw: 0 }, "GPT_CHAT_MODE_MISSING", [1_500, 3_000]],
] as const) {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, conversationFacts("", overrides));
    throw new Error(`MODE_TOPOLOGY_FAILURE_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, code);
  assert.deepEqual(fixture.waitDurations(), waits);
  assert.equal(fixture.physicalMutations(), 0);
}

for (const [draft, mode, code] of [
  ["stale draft", "work", "GPT_CHAT_MODE_WORK_SELECTED_WITH_DRAFT"],
  ["", "invalid", "GPT_CHAT_MODE_INVALID"],
] as const) {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, conversationFacts(draft, { mode }));
    throw new Error(`INVALID_FRESH_MODE_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("prepare_clean_gpt_chat", fixture.browser, { timeoutMs: 60_000 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, code);
  assert.equal(fixture.physicalMutations(), 0);
}

let profileOpen = false;
let profileHydrated = false;
const profileFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") {
    return coherentObservationPacket(intent, profileFacts(intent, profileOpen, 0, profileHydrated));
  }
  if (intent.kind === "click" && intent.selector === GPT_PROFILE_TRIGGER_SELECTOR) {
    if (intent.postClickObservation) {
      const opening = !profileOpen;
      profileOpen = opening;
      assert.equal(intent.postClickObservation.timeoutMs, undefined);
      if (opening) {
        assert.deepEqual(intent.postClickObservation.queries.map((query) => [
          query.queryId, query.expectedEligibleCount,
        ]), [
          ["popup", 1], ["simple-panel", 1], ["reasoning-control", 1],
          ["enabled-reasoning-control", 1], ["reasoning-value", 1], ["trigger", 1],
        ], "profile open must prove the complete topology in the same Browser mutation packet");
        assert.deepEqual(intent.postClickObservation.queries.map((query) => [
          query.queryId, query.fields,
        ]), [
          ["popup", ["ariaLabelledBy"]], ["simple-panel", []], ["reasoning-control", []],
          ["enabled-reasoning-control", []],
          ["reasoning-value", ["ariaValueMin", "ariaValueMax", "ariaValueNow"]],
          ["trigger", ["id", "ariaExpanded"]],
        ], "GPT must request only the governed mechanical profile fields in the same Browser packet");
      } else {
        assert.deepEqual(intent.postClickObservation.queries.map((query) => [
          query.queryId, query.expectedEligibleCount,
        ]), [["popup", 0], ["trigger", 1], ["composer", 1]],
        "profile close must prove popup absence, collapsed exact trigger, and usable composer in one packet");
      }
      profileHydrated = opening;
      const queries = intent.postClickObservation.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries },
          profileFacts({ queries }, opening, 0, opening)),
      };
    } else {
      profileOpen = false;
      profileHydrated = false;
    }
    return { postconditionVerified: true };
  }
  throw new Error(`UNEXPECTED_PROFILE_INTENT:${intent.kind}`);
});
const openedProfile = await execute("open_gpt_execution_profile", profileFixture.browser, { profile });
assert.equal(openedProfile.status, "success", openedProfile.failureCode ?? "profile open failed");
assert.equal(openedProfile.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
assert.equal(profileFixture.physicalMutations(), 1);
const alreadyOpenProfile = await execute("open_gpt_execution_profile", profileFixture.browser, { profile });
assert.equal(alreadyOpenProfile.status, "success", alreadyOpenProfile.failureCode ?? "open profile readback failed");
assert.equal(alreadyOpenProfile.value?.state, "profile-popup-open");
assert.equal(profileFixture.physicalMutations(), 1, "an already-DONE profile must not click again");
const closedProfile = await execute("close_gpt_execution_profile", profileFixture.browser, { profile });
assert.equal(closedProfile.status, "success", closedProfile.failureCode ?? "profile close failed");
assert.equal(profileFixture.physicalMutations(), 2);

await exerciseTransientProfileConfirmations();

{
  let simulatedNow = 0;
  let observeCount = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observeCount += 1;
      return coherentObservationPacket(intent, simulatedNow === 0 ? {} : profileFacts(intent, false, 0, false));
    }
    if (intent.kind === "click" && intent.postClickObservation) {
      const queries = intent.postClickObservation.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, profileFacts({ queries }, true, 1, true)),
      };
    }
    throw new Error(`UNEXPECTED_PROFILE_HYDRATION_INTENT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("open_gpt_execution_profile", fixture.browser, { profile });
    assert.equal(result.status, "success", result.failureCode ?? "profile hydration failed");
    assert.ok(observeCount >= 2, "a fully absent profile must be observed fresh until its trigger hydrates");
    assert.ok(fixture.waitDurations().length >= 1);
    assert.equal(fixture.physicalMutations(), 1, "hydration must not add a second click");
  } finally {
    Date.now = nativeDateNow;
  }
}

for (const queryId of [
  "popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value", "trigger",
] as const) {
  for (const variant of ["ambiguous", "ineligible"] as const) {
    const fixture = fakeBrowser((intent) => {
      if (intent.kind === "observe") return coherentObservationPacket(intent, {
        ...profileFacts(intent, false, 0, false),
        [queryId]: variant === "ambiguous" ? {
          rawCount: 2, eligibleCount: 2,
        } : {
          rawCount: 1, eligibleCount: 0,
          rejections: [{ index: 0, reasons: ["NO_LAYOUT_BOX"] }],
          nativeCauseCode: "NO_LAYOUT_BOX", nativeCauseCount: 1,
        },
      });
      throw new Error(`PROFILE_PARTIAL_CONFLICT_MUST_NOT_ACT:${queryId}:${variant}:${intent.kind}`);
    });
    const result = await execute("open_gpt_execution_profile", fixture.browser, { profile });
    assert.equal(result.status, "failed");
    assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID:"));
    assert.ok(result.failureCode?.includes(`${queryId}[scope=0/0;raw=${variant === "ambiguous" ? 2 : 1};eligible=${variant === "ambiguous" ? 2 : 0}`));
    if (variant === "ineligible") {
      assert.ok(result.failureCode?.includes("native=NO_LAYOUT_BOX/1"));
      assert.equal(result.proof.nativeFailureCode, "NO_LAYOUT_BOX");
    }
    for (const retainedQueryId of [
      "popup", "simple-panel", "reasoning-control", "enabled-reasoning-control", "reasoning-value", "trigger",
    ]) assert.ok(result.failureCode?.includes(`${retainedQueryId}[`));
    assert.ok(result.failureCode?.includes(`revision=sha256:${"4".repeat(64)}`));
    assert.equal(result.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
    assert.equal(result.proof.committedMutation, "no");
    assert.deepEqual(fixture.waitDurations(), variant === "ambiguous" ? [] : [1_500, 3_000],
      "only a non-contradictory no-layout sample may receive bounded confirmation");
    assert.equal(fixture.physicalMutations(), 0);
  }
}

{
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent, profileFacts(intent, false, 0, false));
    }
    if (intent.kind === "click" && intent.postClickObservation) {
      const queries = intent.postClickObservation.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, {
          ...profileFacts({ queries }, true, 1, true),
          "reasoning-control": { rawCount: 0, eligibleCount: 0 },
        }),
      };
    }
    throw new Error(`PROFILE_FAILED_POSTCONDITION_MUST_NOT_REREAD:${intent.kind}`);
  });
  const result = await execute("open_gpt_execution_profile", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_POPUP_INVALID:"));
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(result.proof.postconditionResult, "failed");
  assert.equal(observations, 1, "a failed profile postcondition must not issue a follow-up DOM observation");
  assert.equal(fixture.physicalMutations(), 1);
}

{
  let simulatedNow = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {});
    throw new Error(`PROFILE_TIMEOUT_MUST_NOT_ACT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("open_gpt_execution_profile", fixture.browser, { profile });
    assert.equal(result.status, "failed");
    assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_OPEN_QUALIFICATION_INVALID:"));
    assert.equal(simulatedNow, 4_500,
      "profile confirmation must execute the exact 1.5-second and 3-second stages");
    assert.equal(fixture.physicalMutations(), 0);
  } finally {
    Date.now = nativeDateNow;
  }
}

for (const driftField of [
  "exactCallIdentityHash", "targetRefHash", "documentRefHash", "currentUrl",
] as const) {
  let simulatedNow = 0;
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      const packet = coherentObservationPacket(intent,
        observations === 1 ? {} : profileFacts(intent, false, 0, false));
      return observations === 1 ? packet : { ...packet,
        [driftField]: driftField === "currentUrl"
          ? "https://chatgpt.com/c/another-conversation" : `sha256:${"5".repeat(64)}` };
    }
    throw new Error(`PROFILE_DOCUMENT_DRIFT_MUST_NOT_ACT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("open_gpt_execution_profile", fixture.browser, { profile });
    assert.equal(result.status, "failed");
    assert.equal(result.failureCode, "GPT_DOM_CONFIRMATION_IDENTITY_CHANGED");
    assert.equal(result.proof.committedMutation, "no");
    assert.equal(fixture.physicalMutations(), 0);
  } finally {
    Date.now = nativeDateNow;
  }
}

await exerciseExactModelSelection();
await exercisePreExecutionFailureEvidence();
