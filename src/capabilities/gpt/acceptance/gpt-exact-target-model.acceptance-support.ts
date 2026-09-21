import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";
import { GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR as GPT_MODEL_SELECTOR_OPEN_ENTRY }
  from "../children/open_gpt_model_selector_v2/selectors.js";
import { GPT_MODEL_SELECTION_V2_CHOICE_SELECTOR }
  from "../children/select_exact_gpt_model_v2/selectors.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { exerciseFailedEvidenceReadback }
  from "./gpt-failure-evidence-readback.acceptance-support.js";
import { execute, profile } from "./gpt-exact-target-profile-fixture.js";

export const exerciseExactModelSelection = async (): Promise<void> => {
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
      if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTOR_OPEN_ENTRY) {
        assert.deepEqual(intent.postClickObservation?.queries.map((query) => [
          query.queryId, query.expectedEligibleCount,
        ]), [["model-choice", 1]],
        "the one Browser click must prove only the exact target-model option");
        assert.equal(intent.postClickObservation?.timeoutMs, undefined);
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
      "GPT_MODEL_SELECTION_V2_STATE_INVALID:openableEntry=0:modelChoice=0");
    assert.deepEqual(fixture.waitDurations(), [1_500, 3_000]);
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
      "GPT_MODEL_SELECTION_V2_STATE_INVALID:openableEntry=0:modelChoice=0");
    assert.equal(result.proof.committedMutation, "no");
    assert.deepEqual(fixture.waitDurations(), [1_500, 3_000]);
    assert.equal(fixture.physicalMutations(), 0);
  }
  
  {
    let clicked = false;
    const fixture = fakeBrowser((intent) => {
      if (intent.kind === "observe") {
        return coherentObservationPacket(intent, modelFacts(clicked ? "broken" : "closed"));
      }
      if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTOR_OPEN_ENTRY) {
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
    const failureCode = "GPT_MODEL_SELECTION_V2_STATE_INVALID:openableEntry=0:modelChoice=0";
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
      child_proof_ref: null,
      child_proof_hash: null,
      stopped_empty_proof: null,
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
        ]), [["model-choice", 0]],
        "model selection must prove that the exact chosen option closed in the same Browser mutation packet");
        assert.equal(intent.postClickObservation?.timeoutMs, undefined);
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
  
};

