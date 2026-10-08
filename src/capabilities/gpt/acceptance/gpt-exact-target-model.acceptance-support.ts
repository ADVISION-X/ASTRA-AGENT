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
  for (const startModelDisplayName of ["最新", "GPT-5.6 Sol"] as const) {
    const configured = buildGptExecutionProfile({ ...profile, startModelDisplayName });
    const expected = startModelDisplayName === "最新" ? ["最新", "Latest", "GPT-6"] : "GPT-5.6 Sol";
    const queryId = startModelDisplayName === "最新" ? "latest-model" : "sol-model";
    for (const checked of ["true", "false"] as const) {
      for (const scenario of ["valid", "wrong-attribute", "menu-open", "pending"] as const) {
        const fixture = fakeBrowser((intent) => {
          if (intent.kind === "observe") {
            assert.deepEqual(intent.queries[0]?.textEquals, expected);
            const facts = choiceFacts({ checked });
            return coherentObservationPacket(intent, { ...facts,
              [queryId]: { rawCount: 1, eligibleCount: 1, matches: [{ ariaChecked: checked,
                ariaDisabled: false, disabled: false, inert: false }] } });
          }
          if (intent.kind === "click" && intent.selector === GPT_MODEL_CHOICE_SELECTOR) {
            assert.deepEqual(intent.expectedTextEquals, expected);
            assert.deepEqual(intent.postClickObservation?.clickedCandidateAttribute,
              { name: "aria-checked", equals: "true" });
            const queries = intent.postClickObservation!.queries
              .map(({ expectedEligibleCount: _expected, ...query }) => query);
            return { postconditionVerified: true, receiptMissing: scenario === "pending",
              clickedCandidateAttributeReadback: { name: "aria-checked",
                value: scenario === "wrong-attribute" ? "false" : "true", verified: true },
              postconditionObservation: coherentObservationPacket({ queries }, {
                [queryId]: { rawCount: scenario === "menu-open" ? 1 : 0,
                  eligibleCount: scenario === "menu-open" ? 1 : 0,
                  matches: scenario === "menu-open" ? [{ ariaChecked: "true", ariaDisabled: false,
                    disabled: false, inert: false }] : [] },
              }) };
          }
          throw new Error(`UNEXPECTED_MODEL_SELECT_INTENT:${intent.kind}`);
        });
        const result = await execute("select_gpt_model_from_start_v3", fixture.browser, { profile: configured });
        assert.equal(result.status, scenario === "valid" ? "success" : "failed");
        assert.equal(fixture.physicalMutations(), 1, "failed fresh postconditions must never replay model input");
        if (scenario === "valid") {
          assert.equal(result.value?.modelDisplayName, startModelDisplayName);
          assert.equal(result.value?.previousChecked, checked);
          assert.equal(result.value?.state, "model-selected");
        }
      }
    }
  }
};

const verifyLatestUnavailableFailsClosed = async (): Promise<void> => {
  for (const startModelDisplayName of ["最新", "GPT-5.6 Sol"] as const) {
    const configured = buildGptExecutionProfile({ ...profile, startModelDisplayName });
    const queryId = startModelDisplayName === "最新" ? "latest-model" : "sol-model";
    for (const reason of ["disabled", "ariaDisabled", "inert", "hidden"] as const) {
      const fixture = fakeBrowser((intent) => {
        if (intent.kind === "observe") return coherentObservationPacket(intent, {
          ...choiceFacts({ checked: "true" }),
          [queryId]: { rawCount: 1, eligibleCount: reason === "hidden" ? 0 : 1,
            matches: reason === "hidden" ? [] : [{ ariaChecked: "true",
              ariaDisabled: reason === "ariaDisabled", disabled: reason === "disabled", inert: reason === "inert" }] },
        });
        throw new Error(`EXPLICIT_DOWNGRADE_MUST_NOT_CLICK:${intent.kind}`);
      });
      const result = await execute("select_gpt_model_from_start_v3", fixture.browser, { profile: configured });
      assert.equal(result.status, "failed", "an unavailable exact model must never select another model");
      assert.equal(result.value, null);
      assert.equal(fixture.physicalMutations(), 0);
    }
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

const verifyLatestLabels = async (): Promise<void> => {
  const latestProfile = buildGptExecutionProfile({
    profileRef: "acceptance:gpt-latest-labels", startModelDisplayName: "最新",
    requestedReasoningValue: 4, executorIdentityRef: "acceptance:executor",
    acceptanceRef: "acceptance:gpt-exact-target", acceptanceVersion: "v1",
  });
  const approved = ["最新", "Latest", "GPT-6"];
  for (const labels of [["最新"], ["Latest"], ["GPT-6"], ["最新", "Latest"], ["最新", "GPT-6"],
    ["Latest", "GPT-6"], approved, ["GPT-6", "GPT-6"], ["Latest beta"], ["GPT-5.6 Sol"],
    ["GPT-5.5"], ["GPT-6 Pro"], ["GPT-6.1"], ["GPT6"], []]) {
    for (const checked of ["true", "false"] as const) {
      const matching = labels.filter((label) => approved.includes(label));
      let open = false;
      const fixture = fakeBrowser((intent) => {
        if (intent.kind === "observe") {
          for (const query of intent.queries) {
            if (query.queryId === "specified-model" || query.queryId === "latest-model") {
              assert.deepEqual(query.textEquals, approved);
            }
          }
          return coherentObservationPacket(intent, {
            "openable-entry": { rawCount: open ? 0 : 1, eligibleCount: open ? 0 : 1 },
            "specified-model": { rawCount: labels.length, eligibleCount: open ? matching.length : 0 },
            "latest-model": { rawCount: labels.length, eligibleCount: matching.length,
              matches: matching.map(() => ({ ariaChecked: checked, ariaDisabled: false,
                disabled: false, inert: false })) },
            "selected-model-count": { rawCount: checked === "true" ? 1 : 0,
              eligibleCount: checked === "true" ? 1 : 0 },
          });
        }
        if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTOR_OPENABLE_ENTRY) {
          assert.deepEqual(intent.postClickMatch?.textEquals, approved);
          assert.equal(intent.postClickMinimumDelayMs, 2_500);
          assert.equal(intent.postClickMatch?.expectedMatches, 1);
          open = true;
          return { postconditionVerified: matching.length === 1,
            postconditionEligibleCount: matching.length, postconditionRawCount: labels.length };
        }
        if (intent.kind === "click" && intent.selector === GPT_MODEL_CHOICE_SELECTOR) {
          assert.equal(matching.length, 1, "ambiguous labels must never cause model input");
          assert.deepEqual(intent.expectedTextEquals, approved);
          assert.deepEqual(intent.postClickObservation?.queries[0]?.textEquals, approved);
          const queries = intent.postClickObservation!.queries
            .map(({ expectedEligibleCount: _expected, ...query }) => query);
          return { postconditionVerified: true,
            clickedCandidateAttributeReadback: { name: "aria-checked", value: "true", verified: true },
            postconditionObservation: coherentObservationPacket({ queries }, {
              "latest-model": { rawCount: 0, eligibleCount: 0 },
            }) };
        }
        throw new Error(`UNEXPECTED_LATEST_LABEL_INTENT:${intent.kind}`);
      });
      const opened = await execute("open_gpt_model_selector_v3", fixture.browser, { profile: latestProfile });
      assert.equal(opened.status, matching.length === 1 ? "success" : "failed");
      assert.equal(fixture.physicalMutations(), 1, "G15 opening input must remain accounted for");
      const before = fixture.physicalMutations();
      const selected = await execute("select_gpt_model_from_start_v3", fixture.browser, { profile: latestProfile });
      assert.equal(selected.status, matching.length === 1 ? "success" : "failed");
      assert.equal(fixture.physicalMutations() - before, matching.length === 1 ? 1 : 0);
      if (matching.length === 1) {
        assert.equal(selected.value?.modelDisplayName, "最新", "Product model identity must stay unchanged");
        assert.equal(selected.value?.previousChecked, checked);
      }
    }
  }
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
  await verifyLatestLabels();
  await verifyLatestUnavailableFailsClosed();
  await verifySelectedCountConflictFailsClosed();
};
