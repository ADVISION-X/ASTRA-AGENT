import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import {
  buildGptExecutionProfile,
} from "../index.js";
import { GPT_CHILD_CAPABILITY_CONTRACTS } from "../contract.js";
import { emitQualityProofObservation } from "../../../../scripts/audit/shared/proof-observation.js";
import {
  GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
  GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
} from "../web/contracts/model-selection-v2.contract.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_REASONING_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
  reasoningTierUiLabel,
  reasoningTierUiValue,
} from "../web/contracts/execution-profile.contract.js";
import {
  coherentObservationPacket,
  EXPECTED_GPT_CHILD_IDS,
  fakeBrowser,
} from "./gpt-exact-target-browser-fixture.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { assertGptExactTargetSourceShape } from "./gpt-exact-target-source-support.js";
import { exerciseFailedEvidenceReadback } from "./gpt-failure-evidence-readback.acceptance-support.js";

const { gpt, execute } = createGptAcceptanceHarness("gpt-exact-target");
assert.deepEqual(gpt.listChildCapabilityIds(), EXPECTED_GPT_CHILD_IDS);
assert.equal(Object.keys(GPT_CHILD_CAPABILITY_CONTRACTS).length, 27);
assertGptExactTargetSourceShape(import.meta.url);

const profile = buildGptExecutionProfile({
  profileRef: "acceptance:gpt-profile",
  accountCapabilityRef: "acceptance:account-capability",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: {
    selectionPolicy: "exact-or-observed-maximum",
    requestedTier: "pro_standard",
  },
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-exact-target",
  acceptanceVersion: "v1",
});

const profileFacts = (
  intent: Parameters<typeof coherentObservationPacket>[0],
  open: boolean,
  reasoningCurrent = 0,
  reasoningReady = open,
  reasoningMaximum = 4,
  reasoningMinimum = 0,
) => {
  const reasoningQuery = intent.queries.find((query) => query.queryId === "reasoning-value");
  const reasoningEligible = reasoningReady
    && reasoningQuery?.readEligibility === "non-actionable-aria-state";
  return ({
  popup: { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  "simple-panel": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  "reasoning-control": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  "enabled-reasoning-control": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
  "reasoning-value": {
    rawCount: reasoningReady ? 1 : 0,
    eligibleCount: reasoningEligible ? 1 : 0,
    matches: reasoningEligible
      ? [{
        ariaValueMin: String(reasoningMinimum),
        ariaValueMax: String(reasoningMaximum),
        ariaValueNow: String(reasoningCurrent),
      }] : [],
    rejections: reasoningReady && !reasoningEligible ? [{ index: 0, reasons: ["ARIA_HIDDEN"] }] : [],
  },
  trigger: {
    rawCount: 1, eligibleCount: 1,
    matches: [{ ariaExpanded: open ? "true" : "false" }],
  },
  });
};

let profileOpen = false;
let profileHydrated = false;
const profileFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") {
    return coherentObservationPacket(intent, profileFacts(intent, profileOpen, 0, profileHydrated));
  }
  if (intent.kind === "click" && intent.selector === GPT_PROFILE_TRIGGER_SELECTOR) {
    if (intent.postClickObservation) {
      profileOpen = true;
      assert.equal(intent.postClickObservation.timeoutMs, 5_000);
      assert.deepEqual(intent.postClickObservation.queries.map((query) => [
        query.queryId, query.expectedEligibleCount,
      ]), [
        ["popup", 1], ["simple-panel", 1], ["reasoning-control", 1],
        ["enabled-reasoning-control", 1], ["reasoning-value", 1], ["trigger", 1],
      ], "profile open must prove the complete topology in the same Browser mutation packet");
      assert.deepEqual(intent.postClickObservation.queries.map((query) => [
        query.queryId, query.fields,
      ]), [
        ["popup", []], ["simple-panel", []], ["reasoning-control", []],
        ["enabled-reasoning-control", []],
        ["reasoning-value", ["ariaValueMin", "ariaValueMax", "ariaValueNow"]],
        ["trigger", ["ariaExpanded"]],
      ], "GPT must request only the governed mechanical profile fields in the same Browser packet");
      profileHydrated = true;
      const queries = intent.postClickObservation.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, profileFacts({ queries }, true, 0, true)),
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
    assert.equal(fixture.waitDurations().length, 0, "partial profile structure must fail without waiting");
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
    assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_HYDRATION_TIMEOUT:"));
    assert.equal(simulatedNow, 5_000, "profile hydration must not exceed its strict five-second ceiling");
    assert.equal(fixture.physicalMutations(), 0);
  } finally {
    Date.now = nativeDateNow;
  }
}

for (const driftField of ["targetRefHash", "documentRefHash"] as const) {
  let simulatedNow = 0;
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      const packet = coherentObservationPacket(intent,
        observations === 1 ? {} : profileFacts(intent, false, 0, false));
      return observations === 1 ? packet : { ...packet, [driftField]: `sha256:${"5".repeat(64)}` };
    }
    throw new Error(`PROFILE_DOCUMENT_DRIFT_MUST_NOT_ACT:${intent.kind}`);
  }, { onWait: (durationMs) => { simulatedNow += durationMs; } });
  const nativeDateNow = Date.now;
  Date.now = () => simulatedNow;
  try {
    const result = await execute("open_gpt_execution_profile", fixture.browser, { profile });
    assert.equal(result.status, "failed");
    assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_HYDRATION_DOCUMENT_CHANGED:"));
    assert.equal(result.proof.committedMutation, "no");
    assert.equal(fixture.physicalMutations(), 0);
  } finally {
    Date.now = nativeDateNow;
  }
}

type ModelState = "closed" | "transition" | "open" | "broken";
const modelFacts = (state: ModelState, checked?: "true" | "false") => ({
  popup: { rawCount: 1, eligibleCount: 1 },
  entry: { rawCount: 1,
    eligibleCount: state === "open" || state === "broken" ? 0 : 1 },
  "openable-entry": { rawCount: state === "closed" ? 1 : 0,
    eligibleCount: state === "closed" ? 1 : 0 },
  "simple-panel": { rawCount: 1,
    eligibleCount: state === "closed" ? 1 : 0 },
  "advanced-panel": { rawCount: state === "open" || state === "transition" ? 1 : 0,
    eligibleCount: state === "open" || state === "transition" ? 1 : 0 },
  ...(checked === undefined ? {} : {
    "model-choice": { rawCount: 1, eligibleCount: 1, matches: [{ ariaChecked: checked }] },
  }),
});

for (const initiallyOpen of [true, false]) {
  let state: ModelState = initiallyOpen ? "open" : "closed";
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(state));
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR) {
      assert.deepEqual(intent.postClickObservation?.queries.map((query) => [
        query.queryId, query.expectedEligibleCount,
      ]), [["popup", 1], ["entry", 0], ["openable-entry", 0], ["simple-panel", 0], ["advanced-panel", 1]],
      "the one Browser click must mechanically prove the five-part stable topology");
      assert.equal(intent.postClickObservation?.timeoutMs, 5_000);
      state = "open";
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, modelFacts(state)),
      };
    }
    throw new Error(`UNEXPECTED_MODEL_OPEN_INTENT:${intent.kind}`);
  });
  const result = await execute("open_gpt_model_selector_v2", fixture.browser, { profile });
  assert.equal(result.status, "success", result.failureCode ?? "model selector failed");
  assert.equal(state, "open");
  assert.equal(fixture.physicalMutations(), initiallyOpen ? 0 : 1);
}

{
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts("transition"));
    throw new Error(`TRANSITIONAL_MODEL_TOPOLOGY_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("open_gpt_model_selector_v2", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode,
    "GPT_MODEL_SELECTION_V2_STATE_INVALID:popup=1:entry=1:openableEntry=0:simple=0:advanced=1");
  assert.equal(result.proof.committedMutation, "no");
  assert.equal(fixture.physicalMutations(), 0);
}

{
  let clicked = false;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, modelFacts(clicked ? "broken" : "closed"));
    }
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR) {
      clicked = true;
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, modelFacts("broken")),
      };
    }
    throw new Error(`UNEXPECTED_CONFIRMED_MODEL_DRIFT_INTENT:${intent.kind}`);
  });
  const result = await execute("open_gpt_model_selector_v2", fixture.browser, { profile });
  const failureCode = "GPT_MODEL_SELECTION_V2_STATE_INVALID:popup=1:entry=0:openableEntry=0:simple=0:advanced=0";
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, failureCode);
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(result.proof.postconditionResult, "failed");
  assert.equal(result.proof.browserFact?.browserOutcome, "CONFIRMED");
  assert.equal(result.proof.browserFact?.mutationOutcome, "confirmed");
  assert.equal(fixture.physicalMutations(), 1);
  await exerciseFailedEvidenceReadback(result, Object.freeze({ profile }), {
    code: failureCode,
    mutation_outcome: "confirmed",
    effect_scope: "target_local",
    child_capability_id: "open_gpt_model_selector_v2",
    browser_outcome: "CONFIRMED",
    evidence_ref: "browser-mutation:acceptance-call",
    evidence_hash: `sha256:${"9".repeat(64)}`,
    cause: null,
  });
}

for (const checked of ["true", "false"] as const) {
  let state: ModelState = "open";
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent, modelFacts(state, checked));
    }
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR) {
      assert.equal(intent.expectedTextEquals, profile.modelDisplayName);
      assert.deepEqual(intent.postClickObservation?.queries.map((query) => [
        query.queryId, query.expectedEligibleCount,
      ]), [["popup", 1], ["entry", 1], ["openable-entry", 1], ["simple-panel", 1], ["advanced-panel", 0]],
      "model selection must prove the restored five-part topology in the same Browser mutation packet");
      assert.equal(intent.postClickObservation?.timeoutMs, 5_000);
      state = "closed";
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, modelFacts(state)),
      };
    }
    throw new Error(`UNEXPECTED_MODEL_SELECT_INTENT:${intent.kind}`);
  });
  const result = await execute("select_exact_gpt_model_v2", fixture.browser, { profile });
  assert.equal(result.status, "success", result.failureCode ?? "model selection failed");
  assert.equal(result.value?.previousChecked, checked);
  assert.equal(result.value?.state, "exact-model-selected");
  assert.equal(observations, 1, "model selection must not issue a second DOM observation after Browser confirmation");
  assert.equal(fixture.physicalMutations(), 1);
}

{
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent, modelFacts("open", "false"));
    }
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR) {
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        postconditionObservation: coherentObservationPacket({ queries }, modelFacts("broken")),
      };
    }
    throw new Error(`UNEXPECTED_MODEL_SELECT_DRIFT_INTENT:${intent.kind}`);
  });
  const result = await execute("select_exact_gpt_model_v2", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode,
    "GPT_MODEL_SELECTION_V2_POSTCONDITION_INVALID:popup=1:entry=0:openableEntry=0:simple=0:advanced=0");
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(result.proof.postconditionResult, "failed");
  assert.equal(observations, 1,
    "a failed same-packet postcondition must not trigger a second DOM observation");
  assert.equal(fixture.physicalMutations(), 1);
}

const exactReasoningProfile = (requestedTier: "high" | "pro_standard") => buildGptExecutionProfile({
  profileRef: `acceptance:gpt-profile:${requestedTier}`,
  accountCapabilityRef: "acceptance:account-capability",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: { selectionPolicy: "exact", requestedTier },
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-exact-target",
  acceptanceVersion: "v1",
});

const runReasoning = async (input: Readonly<{
  executionProfile: typeof profile;
  maximum: number;
  current: number;
  readbackCurrent?: number;
}>) => {
  let current = input.current;
  let keypresses = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, profileFacts(intent, true, current, true, input.maximum));
    }
    if (intent.kind === "keypress") {
      keypresses += 1;
      const target = input.executionProfile.reasoningRequirement.selectionPolicy === "exact"
        ? reasoningTierUiValue[input.executionProfile.reasoningRequirement.requestedTier]
        : input.maximum;
      const delta = target - input.current;
      assert.equal(intent.selector, GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
        "the actionable target must remain the visible enabled capability menu item");
      assert.equal(intent.key, delta < 0 ? "ArrowLeft" : "ArrowRight");
      assert.equal(intent.repeat, Math.abs(delta));
      assert.equal(intent.postKeypressMatch.readEligibility, "non-actionable-aria-state");
      assert.equal(intent.postKeypressMatch.selector,
        `${GPT_PROFILE_REASONING_VALUE_SELECTOR}[aria-valuenow='${target}']`);
      current = input.readbackCurrent ?? target;
      return { postconditionVerified: true };
    }
    throw new Error(`UNEXPECTED_REASONING_INTENT:${intent.kind}`);
  });
  const result = await execute(
    "ensure_gpt_reasoning_requirement", fixture.browser, { profile: input.executionProfile },
  );
  return Object.freeze({ result, fixture, keypresses });
};

for (const reasoningCase of [
  Object.freeze({ maximum: 4, current: 1, resolvedTier: "pro_standard" as const,
    resolvedValue: 4, degraded: false, mutation: "confirmed" as const }),
  Object.freeze({ maximum: 4, current: 4, resolvedTier: "pro_standard" as const,
    resolvedValue: 4, degraded: false, mutation: "no" as const }),
  Object.freeze({ maximum: 2, current: 0, resolvedTier: "high" as const,
    resolvedValue: 2, degraded: true, mutation: "confirmed" as const }),
  Object.freeze({ maximum: 2, current: 2, resolvedTier: "high" as const,
    resolvedValue: 2, degraded: true, mutation: "no" as const }),
]) {
  const { result, fixture, keypresses } = await runReasoning({ executionProfile: profile, ...reasoningCase });
  assert.equal(result.status, "success", result.failureCode ?? "adaptive reasoning selection failed");
  assert.deepEqual(result.reasoningRequirementResult, {
    requestedTier: "pro_standard",
    requestedValue: 4,
    selectionPolicy: "exact-or-observed-maximum",
    observedScale: { min: 0, max: reasoningCase.maximum, currentBefore: reasoningCase.current },
    resolvedTier: reasoningCase.resolvedTier,
    resolvedValue: reasoningCase.resolvedValue,
    degraded: reasoningCase.degraded,
    currentValue: reasoningCase.resolvedValue,
    mutationOutcome: reasoningCase.mutation,
    browserOutcome: reasoningCase.mutation === "confirmed" ? "CONFIRMED" : null,
    gptPostcondition: "passed",
  });
  assert.equal(result.value?.state, reasoningCase.mutation === "confirmed" ? "selected" : "already-selected");
  assert.equal(result.proof.committedMutation, reasoningCase.mutation);
  assert.equal(keypresses, reasoningCase.mutation === "confirmed" ? 1 : 0);
  assert.equal(fixture.physicalMutations(), reasoningCase.mutation === "confirmed" ? 1 : 0);
}

for (const maximum of [2, 4]) {
  const exactHigh = exactReasoningProfile("high");
  const { result, fixture } = await runReasoning({ executionProfile: exactHigh, maximum, current: 2 });
  assert.equal(result.status, "success", result.failureCode ?? "exact high must remain available");
  assert.deepEqual(result.reasoningRequirementResult, {
    requestedTier: "high", requestedValue: 2, selectionPolicy: "exact",
    observedScale: { min: 0, max: maximum, currentBefore: 2 },
    resolvedTier: "high", resolvedValue: 2, degraded: false, currentValue: 2,
    mutationOutcome: "no", browserOutcome: null, gptPostcondition: "passed",
  });
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const exactPro = exactReasoningProfile("pro_standard");
  const { result, fixture } = await runReasoning({ executionProfile: exactPro, maximum: 2, current: 1 });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_REASONING_TIER_UNAVAILABLE");
  assert.deepEqual(result.reasoningRequirementResult, {
    requestedTier: "pro_standard", requestedValue: 4, selectionPolicy: "exact",
    observedScale: { min: 0, max: 2, currentBefore: 1 },
    resolvedTier: null, resolvedValue: null, degraded: false, currentValue: 1,
    mutationOutcome: "no", browserOutcome: null, gptPostcondition: "failed",
  });
  assert.equal(fixture.physicalMutations(), 0);
  await exerciseFailedEvidenceReadback(result, Object.freeze({ profile: exactPro }), {
    code: "GPT_REASONING_TIER_UNAVAILABLE",
    mutation_outcome: "no",
    effect_scope: null,
    child_capability_id: null,
    browser_outcome: null,
    evidence_ref: "record:gpt-failed-readback",
    evidence_hash: result.proof.evidenceHash,
    cause: null,
  });
}

for (const maximum of [1, 3, 5]) {
  const { result, fixture } = await runReasoning({ executionProfile: profile, maximum, current: 0 });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID:"));
  assert.equal(result.reasoningRequirementResult?.resolvedValue, null);
  assert.equal(fixture.physicalMutations(), 0, `unknown 0..${maximum} scale must fail without mutation`);
}

for (const malformed of [
  Object.freeze({ name: "nonzero-minimum", minimum: 1, current: 1, maximum: 4 }),
  Object.freeze({ name: "current-out-of-range", minimum: 0, current: 5, maximum: 4 }),
]) {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent,
      profileFacts(intent, true, malformed.current, true, malformed.maximum, malformed.minimum));
    throw new Error(`MALFORMED_REASONING_SCALE_MUST_NOT_ACT:${malformed.name}:${intent.kind}`);
  });
  const result = await execute("ensure_gpt_reasoning_requirement", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID:"));
  assert.equal(fixture.physicalMutations(), 0);
}

for (const state of ["missing", "disabled", "ambiguous"] as const) {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind !== "observe") throw new Error(`INVALID_REASONING_STATE_MUST_NOT_ACT:${state}:${intent.kind}`);
    const facts = profileFacts(intent, true, 1);
    if (state === "missing") return coherentObservationPacket(intent, {
      ...facts,
      "reasoning-value": { rawCount: 1, eligibleCount: 1, matches: [{}] },
    });
    const queryId = state === "disabled" ? "enabled-reasoning-control" : "reasoning-value";
    return coherentObservationPacket(intent, {
      ...facts,
      [queryId]: state === "disabled"
        ? { rawCount: 1, eligibleCount: 0, rejections: [{ index: 0, reasons: ["ARIA_DISABLED"] }] }
        : { rawCount: 2, eligibleCount: 2 },
    });
  });
  const result = await execute("ensure_gpt_reasoning_requirement", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_STATE_INVALID:"));
  assert.equal(fixture.physicalMutations(), 0);
}

{
  const { result, fixture } = await runReasoning({
    executionProfile: profile, maximum: 2, current: 0, readbackCurrent: 1,
  });
  assert.equal(result.status, "failed");
  assert.ok(result.failureCode?.startsWith("GPT_EXECUTION_PROFILE_REASONING_PENDING:"));
  assert.deepEqual(result.reasoningRequirementResult, {
    requestedTier: "pro_standard", requestedValue: 4,
    selectionPolicy: "exact-or-observed-maximum",
    observedScale: { min: 0, max: 2, currentBefore: 0 },
    resolvedTier: "high", resolvedValue: 2, degraded: true, currentValue: 1,
    mutationOutcome: "confirmed", browserOutcome: "CONFIRMED", gptPostcondition: "failed",
  });
  assert.equal(result.proof.committedMutation, "confirmed");
  assert.equal(result.proof.postconditionResult, "failed");
  assert.equal(fixture.physicalMutations(), 1);
}

assert.deepEqual(reasoningTierUiValue, {
  fast: 0, medium: 1, high: 2, extra_high: 3, pro_standard: 4,
});
assert.equal(reasoningTierUiLabel.fast, "极速");
assert.equal(GPT_PROFILE_REASONING_CONTROL_SELECTOR, "[role='menuitem'][aria-label='能力']");
assert.equal(GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  "[role='menuitem'][aria-label='能力']:not([aria-disabled='true'])");
assert.equal(GPT_PROFILE_REASONING_VALUE_SELECTOR, "[data-model-reasoning-effort-slider] [role='slider']");
assert.equal(GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  "[data-testid='composer-model-picker-slider-simple-view'][data-active='true']:not([inert])");

emitQualityProofObservation({
  lawId: "LAW-GPT-001-V24",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:3", "forbidden:4", "forbidden:5", "forbidden:9", "summary"],
  locator: "acceptance:gpt-exact-target:coherent-ready-subset",
  observedValue: "coherent profile model and numeric reasoning Children prove same-revision DONE or one confirmed mutation",
});
emitQualityProofObservation({
  lawId: "LAW-GPT-001-V24",
  evidenceMode: "exam.property",
  clauses: ["forbidden:10", "forbidden:13", "forbidden:15", "forbidden:16", "summary"],
  locator: "acceptance:gpt-exact-target:browser-handoff",
  observedValue: "Browser coherent numeric fields drive one exact reasoning mutation followed by zero-mutation readback",
});
