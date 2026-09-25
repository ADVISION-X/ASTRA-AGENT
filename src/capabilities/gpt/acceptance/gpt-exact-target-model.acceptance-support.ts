import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { GPT_MODEL_SELECTOR_OPENABLE_ENTRY } from "../children/open_gpt_model_selector_v3/selectors.js";
import { GPT_MODEL_CHOICE_SELECTOR } from "../children/select_gpt_model_from_start_v3/selectors.js";
import { buildGptExecutionProfile } from "../index.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { execute, profile } from "./gpt-exact-target-profile-fixture.js";

const selectorFacts = (state: "closed" | "open" | "transition") => ({
  "openable-entry": { rawCount: state === "closed" ? 1 : 0,
    eligibleCount: state === "closed" ? 1 : 0 },
  "specified-model": { rawCount: state === "transition" ? 0 : 2,
    eligibleCount: state === "open" ? 1 : 0,
    rejections: state === "transition" ? [] : state === "open"
      ? [{ index: 0, reasons: ["TEXT_MISMATCH"] }]
      : [{ index: 0, reasons: ["OPACITY_HIDDEN"] },
        { index: 1, reasons: ["OPACITY_HIDDEN", "TEXT_MISMATCH"] }] },
});

const choiceFacts = (input: Readonly<{
  checked: "true" | "false";
  latestDisabled?: boolean;
  latestPresent?: boolean;
  solPresent?: boolean;
}>) => {
  const latestPresent = input.latestPresent ?? true;
  const solPresent = input.solPresent ?? true;
  return {
    "latest-model": { rawCount: latestPresent ? 1 : 0, eligibleCount: latestPresent ? 1 : 0,
      matches: latestPresent ? [{ ariaChecked: "false", ariaDisabled: input.latestDisabled ?? false,
        disabled: false, inert: false }] : [] },
    "sol-model": { rawCount: solPresent ? 1 : 0, eligibleCount: solPresent ? 1 : 0,
      matches: solPresent ? [{ ariaChecked: input.checked, ariaDisabled: false,
        disabled: false, inert: false }] : [] },
    "selected-model-count": { rawCount: input.checked === "true" ? 1 : 0,
      eligibleCount: input.checked === "true" ? 1 : 0 },
  };
};

const verifyModelOpen = async (): Promise<void> => {
  for (const initiallyOpen of [true, false]) {
    let state: "closed" | "open" = initiallyOpen ? "open" : "closed";
    const fixture = fakeBrowser((intent) => {
      if (intent.kind === "observe") return coherentObservationPacket(intent, selectorFacts(state));
      if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTOR_OPENABLE_ENTRY) {
        assert.equal(intent.postClickMinimumDelayMs, 2_500);
        assert.equal(intent.postClickMatch?.expectedMatches, 1);
        assert.equal(intent.postClickMatch?.selector,
          "[data-model-picker-view='advanced'] [role='menuitemradio']");
        assert.equal(intent.postClickMatch?.textEquals, profile.startModelDisplayName);
        state = "open";
        return { postconditionVerified: true, postconditionRawCount: 2,
          postconditionEligibleCount: 1 };
      }
      throw new Error(`UNEXPECTED_MODEL_OPEN_INTENT:${intent.kind}`);
    });
    const result = await execute("open_gpt_model_selector_v3", fixture.browser, { profile });
    assert.equal(result.status, "success", result.failureCode ?? "selector open failed");
    assert.equal(state, "open");
    assert.equal(fixture.physicalMutations(), initiallyOpen ? 0 : 1);
  }
};

const verifyDuplicateSpecifiedModelFailsClosed = async (): Promise<void> => {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...selectorFacts("open"),
      "specified-model": { rawCount: 3, eligibleCount: 2,
        rejections: [{ index: 0, reasons: ["TEXT_MISMATCH"] }] },
    });
    throw new Error(`DUPLICATE_MODEL_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("open_gpt_model_selector_v3", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.equal(fixture.physicalMutations(), 0);
};

const verifySelectorTransitionFailsClosed = async (): Promise<void> => {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, selectorFacts("transition"));
    throw new Error(`TRANSITION_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("open_gpt_model_selector_v3", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_MODEL_SELECTOR_V3_STATE_INVALID:openableEntry=0:specifiedModel=0");
  assert.deepEqual(fixture.waitDurations(), [1_500, 3_000]);
  assert.equal(fixture.physicalMutations(), 0);
};

const verifyModelSelection = async (): Promise<void> => {
  for (const checked of ["true", "false"] as const) {
    const fixture = fakeBrowser((intent) => {
      if (intent.kind === "observe") return coherentObservationPacket(intent, choiceFacts({ checked }));
      if (intent.kind === "click" && intent.selector === GPT_MODEL_CHOICE_SELECTOR) {
        assert.equal(intent.expectedTextEquals, "GPT-5.6 Sol");
        assert.deepEqual(intent.postClickObservation?.clickedCandidateAttribute,
          { name: "aria-checked", equals: "true" });
        const queries = intent.postClickObservation!.queries
          .map(({ expectedEligibleCount: _expected, ...query }) => query);
        return { postconditionVerified: true,
          clickedCandidateAttributeReadback: { name: "aria-checked", value: "true", verified: true },
          postconditionObservation: coherentObservationPacket({ queries }, {
            "sol-model": { rawCount: 0, eligibleCount: 0 },
          }) };
      }
      throw new Error(`UNEXPECTED_MODEL_SELECT_INTENT:${intent.kind}`);
    });
    const result = await execute("select_gpt_model_from_start_v3", fixture.browser, { profile });
    assert.equal(result.status, "success", result.failureCode ?? "model selection failed");
    assert.equal(result.value?.modelDisplayName, "GPT-5.6 Sol");
    assert.equal(result.value?.previousChecked, checked);
    assert.equal(result.value?.state, "model-selected");
    assert.equal(fixture.physicalMutations(), 1);
  }
};

const verifyMissingStartFailsClosed = async (): Promise<void> => {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent,
      choiceFacts({ checked: "false", solPresent: false }));
    throw new Error(`MISSING_START_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("select_gpt_model_from_start_v3", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.equal(fixture.physicalMutations(), 0);
};

const verifyLatestUnavailableFailsClosed = async (): Promise<void> => {
  const latestProfile = buildGptExecutionProfile({
    profileRef: "acceptance:gpt-latest-start",
    startModelDisplayName: "最新",
    requestedReasoningValue: 4,
    executorIdentityRef: "acceptance:executor",
    acceptanceRef: "acceptance:gpt-exact-target",
    acceptanceVersion: "v1",
  });
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent,
      choiceFacts({ checked: "true", latestDisabled: true }));
    throw new Error(`EXPLICIT_DOWNGRADE_MUST_NOT_CLICK:${intent.kind}`);
  });
  const result = await execute("select_gpt_model_from_start_v3", fixture.browser, { profile: latestProfile });
  assert.equal(result.status, "failed", "latest unavailable must never select Sol");
  assert.equal(result.value, null);
  assert.equal(fixture.physicalMutations(), 0);
};

const verifySelectedCountConflictFailsClosed = async (): Promise<void> => {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {
      ...choiceFacts({ checked: "true" }),
      "selected-model-count": { rawCount: 0, eligibleCount: 0 },
    });
    throw new Error(`SELECTED_COUNT_CONFLICT_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("select_gpt_model_from_start_v3", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_MODEL_V3_CANDIDATE_NOT_PROVEN");
  assert.equal(fixture.physicalMutations(), 0);
};

export const exerciseExactModelSelection = async (): Promise<void> => {
  await verifyModelOpen();
  await verifyDuplicateSpecifiedModelFailsClosed();
  await verifySelectorTransitionFailsClosed();
  await verifyModelSelection();
  await verifyMissingStartFailsClosed();
  await verifyLatestUnavailableFailsClosed();
  await verifySelectedCountConflictFailsClosed();
};
