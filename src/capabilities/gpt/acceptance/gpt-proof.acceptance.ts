import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { buildGptExecutionProfile } from "../index.js";
import {
  GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR,
} from "./gpt-page-fixture-selectors.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";

const profile = buildGptExecutionProfile({
  profileRef: "acceptance:proof-profile",
  accountCapabilityRef: "acceptance:account-capability",
  modelDisplayName: "GPT-5.6 Sol",
  modelFamily: "gpt-5.6",
  reasoningRequirement: {
    selectionPolicy: "exact-or-observed-maximum",
    requestedTier: "pro_standard",
  },
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-proof",
  acceptanceVersion: "v1",
});

const modelFacts = (open: boolean) => ({
  popup: { rawCount: 1, eligibleCount: 1 },
  entry: { rawCount: 2, eligibleCount: open ? 0 : 1 },
  "openable-entry": { rawCount: open ? 0 : 1, eligibleCount: open ? 0 : 1 },
  "simple-panel": { rawCount: 1, eligibleCount: open ? 0 : 1 },
  "advanced-panel": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
});

const doneHarness = createGptAcceptanceHarness("gpt-proof-done");
const doneFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(true));
  throw new Error(`UNEXPECTED_DONE_PROOF_INTENT:${intent.kind}`);
});
const done = await doneHarness.execute("open_gpt_model_selector_v2", doneFixture.browser, { profile });
assert.equal(done.status, "success", done.failureCode ?? "DONE proof failed");
assert.equal(done.proof.internalDecisionCode, "DONE");
assert.deepEqual(done.proof.candidateCardinality, { raw: 2, eligible: 0 },
  "GPT semantic DONE must not require the retained entry DOM nodes to be physically absent");
assert.equal(done.proof.observationRevisionHash, `sha256:${"4".repeat(64)}`);
assert.equal(done.proof.committedMutation, "no");
assert.equal(done.proof.browserFact, null);

let open = false;
const actHarness = createGptAcceptanceHarness("gpt-proof-act");
const actFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(open));
  if (intent.kind === "click" && intent.selector === GPT_MODEL_SELECTION_V2_OPENABLE_ENTRY_SELECTOR) {
    open = true;
    const queries = intent.postClickObservation!.queries
      .map(({ expectedEligibleCount: _expected, ...query }) => query);
    return { postconditionVerified: true,
      postconditionObservation: coherentObservationPacket({ queries }, modelFacts(open)) };
  }
  throw new Error(`UNEXPECTED_ACT_PROOF_INTENT:${intent.kind}`);
});
const acted = await actHarness.execute("open_gpt_model_selector_v2", actFixture.browser, { profile });
assert.equal(acted.status, "success", acted.failureCode ?? "ACT proof failed");
assert.equal(acted.proof.internalDecisionCode, "ACT");
assert.equal(acted.proof.committedMutation, "confirmed");
assert.equal(acted.proof.browserFact?.browserOutcome, "CONFIRMED");
assert.equal(acted.proof.browserFact?.mutationOutcome, "confirmed");
assert.equal(acted.proof.browserFact?.childCapabilityId, "open_gpt_model_selector_v2");
assert.equal(acted.proof.browserFact?.evidenceHash, `sha256:${"9".repeat(64)}`);
assert.equal(JSON.stringify(acted.proof).includes(profile.modelDisplayName), false,
  "proof must contain only hashes, refs, cardinality and typed facts, never sensitive UI text");

let zeroActionOpened = false;
const zeroActionFixture = fakeBrowser((intent) => {
  if (intent.kind === "observe") return coherentObservationPacket(intent, modelFacts(zeroActionOpened));
  if (intent.kind === "click") {
    zeroActionOpened = true;
    const queries = intent.postClickObservation!.queries
      .map(({ expectedEligibleCount: _expected, ...query }) => query);
    return { mutationCount: 0, postconditionVerified: true, zeroActionSatisfied: true,
      postconditionObservation: coherentObservationPacket({ queries }, modelFacts(zeroActionOpened)) };
  }
  throw new Error(`UNEXPECTED_ZERO_ACTION_MODEL_INTENT:${intent.kind}`);
});
const zeroActionResult = await createGptAcceptanceHarness("gpt-proof-zero-action-scope")
  .execute("open_gpt_model_selector_v2", zeroActionFixture.browser, { profile });
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
const stableOne = await stableHarnessOne.execute("open_gpt_model_selector_v2", stableFixture().browser, { profile });
const stableTwo = await stableHarnessTwo.execute("open_gpt_model_selector_v2", stableFixture().browser, { profile });
assert.equal(stableOne.proof.evidenceHash, stableTwo.proof.evidenceHash,
  "same exact call and same facts must produce one stable proof hash");
