import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { GPT_CHILD_CAPABILITY_CONTRACTS } from "../contract.js";
import { emitQualityProofObservation } from "../../../../scripts/audit/shared/proof-observation.js";
import {
  GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR,
  GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
} from "./gpt-page-fixture-selectors.js";
import {
  GPT_PROFILE_POPUP_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_TRIGGER_SELECTOR,
} from "./gpt-page-fixture-selectors.js";
import {
  coherentObservationPacket,
  EXPECTED_GPT_CHILD_IDS,
  fakeBrowser,
} from "./gpt-exact-target-browser-fixture.js";
import { assertGptExactTargetSourceShape } from "./gpt-exact-target-source-support.js";
import {
  exerciseFailedEvidenceReadback,
  exercisePreExecutionFailureEvidence,
} from "./gpt-failure-evidence-readback.acceptance-support.js";
import { execute, gpt, profile, profileFacts } from "./gpt-exact-target-profile-fixture.js";
import "./gpt-reasoning-requirement.acceptance.js";

assert.deepEqual(gpt.listChildCapabilityIds(), EXPECTED_GPT_CHILD_IDS);
assert.equal(Object.keys(GPT_CHILD_CAPABILITY_CONTRACTS).length, 28);
assertGptExactTargetSourceShape(import.meta.url);

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
      assert.equal(intent.postClickObservation.timeoutMs, 5_000);
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
  ...((checked ?? (state === "open" ? "false" : undefined)) === undefined ? {} : {
    "model-choice": { rawCount: 1, eligibleCount: 1,
      matches: [{ ariaChecked: checked ?? "false" }] },
  }),
});

for (const initiallyOpen of [true, false]) {
  let state: ModelState = initiallyOpen ? "open" : "closed";
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(state));
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR) {
      assert.deepEqual(intent.postClickObservation?.queries.map((query) => [
        query.queryId, query.expectedEligibleCount,
      ]), [["popup", 1], ["entry", 0], ["openable-entry", 0], ["simple-panel", 0],
        ["advanced-panel", 1], ["model-choice", 1]],
      "the one Browser click must prove the stable topology and exact target-model hydration");
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
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...modelFacts("open"), "model-choice": { rawCount: 0, eligibleCount: 0 },
    });
    throw new Error(`UNHYDRATED_MODEL_CHOICE_MUST_NOT_COMPLETE:${intent.kind}`);
  });
  const result = await execute("open_gpt_model_selector_v2", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode,
    "GPT_MODEL_SELECTION_V2_STATE_INVALID:popup=1:entry=0:openableEntry=0:simple=0:advanced=1");
  assert.equal(fixture.physicalMutations(), 0,
    "an open advanced shell without the exact target-model radio must fail without mutation");
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
      assert.deepEqual(intent.postClickObservation?.clickedCandidateAttribute,
        { name: "aria-checked", equals: "true" });
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
        clickedCandidateAttributeReadback: { name: "aria-checked", value: "true", verified: true },
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
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      return coherentObservationPacket(intent, modelFacts("open", "false"));
    }
    if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR) {
      const queries = intent.postClickObservation!.queries
        .map(({ expectedEligibleCount: _expected, ...query }) => query);
      return {
        postconditionVerified: true,
        clickedCandidateAttributeReadback: { name: "aria-checked", value: "false", verified: false },
        postconditionObservation: coherentObservationPacket({ queries }, modelFacts("closed")),
      };
    }
    throw new Error(`UNEXPECTED_UNSELECTED_MODEL_INTENT:${intent.kind}`);
  });
  const result = await execute("select_exact_gpt_model_v2", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_MODEL_SELECTION_V2_SELECTED_FACT_INVALID");
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
        clickedCandidateAttributeReadback: { name: "aria-checked", value: "true", verified: true },
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

emitQualityProofObservation({
  lawId: "LAW-GPT-001-V38",
  evidenceMode: "exam.golden",
  clauses: ["forbidden:12", "forbidden:3", "forbidden:4", "forbidden:5", "summary"],
  locator: "acceptance:gpt-exact-target:coherent-ready-subset",
  observedValue: "coherent profile model and numeric reasoning Children prove same-revision DONE or one confirmed mutation",
});
emitQualityProofObservation({
  lawId: "LAW-GPT-001-V38",
  evidenceMode: "exam.property",
  clauses: ["forbidden:12", "forbidden:18", "forbidden:19", "forbidden:6", "summary"],
  locator: "acceptance:gpt-exact-target:browser-handoff",
  observedValue: "Browser coherent numeric fields drive one exact reasoning mutation followed by zero-mutation readback",
});
await exercisePreExecutionFailureEvidence();
