import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { buildGptExecutionProfile } from "../index.js";
import { GPT_PROFILE_TRIGGER_SELECTOR } from "./gpt-page-fixture-selectors.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { createGptAcceptanceHarness } from "./gpt-acceptance-harness.js";

export const { execute } = createGptAcceptanceHarness("gpt-exact-target");

export const profile = buildGptExecutionProfile({
  profileRef: "acceptance:gpt-profile",
  startModelDisplayName: "GPT-5.6 Sol",
  requestedReasoningValue: 5,
  executorIdentityRef: "acceptance:executor",
  acceptanceRef: "acceptance:gpt-exact-target",
  acceptanceVersion: "v1",
});

const reasoningValueFacts = (
  ready: boolean,
  eligible: boolean,
  current: number,
  maximum: number,
  minimum: number,
) => ({
  rawCount: ready ? 1 : 0,
  eligibleCount: eligible ? 1 : 0,
  matches: eligible ? [{
    ariaValueMin: String(minimum), ariaValueMax: String(maximum), ariaValueNow: String(current),
  }] : [],
  rejections: ready && !eligible ? [{ index: 0, reasons: ["ARIA_HIDDEN"] }] : [],
});

export const profileFacts = (
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
    popup: { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0,
      matches: open ? [{ ariaLabelledBy: "profile-trigger" }] : [] },
    "simple-panel": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
    "reasoning-control": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
    "enabled-reasoning-control": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0 },
    "reasoning-value": reasoningValueFacts(
      reasoningReady, reasoningEligible, reasoningCurrent, reasoningMaximum, reasoningMinimum,
    ),
    trigger: {
      rawCount: 1, eligibleCount: 1,
      matches: [{ id: "profile-trigger", ariaExpanded: open ? "true" : "false" }],
    },
    "selected-model": { rawCount: open ? 1 : 0, eligibleCount: open ? 1 : 0,
      matches: open ? [{ ariaChecked: "true", inert: true }] : [] },
    composer: { rawCount: 1, eligibleCount: 1 },
  });
};

const exerciseProfileRecoveryStages = async (): Promise<void> => {
  for (const recoveryObservation of [2, 3] as const) {
    let observations = 0;
    const fixture = fakeBrowser((intent) => {
      if (intent.kind === "observe") {
        observations += 1;
        return coherentObservationPacket(intent,
          observations < recoveryObservation ? {} : profileFacts(intent, true, 0, true));
      }
      if (intent.kind === "click" && intent.selector === GPT_PROFILE_TRIGGER_SELECTOR
        && intent.postClickObservation) {
        const queries = intent.postClickObservation.queries
          .map(({ expectedEligibleCount: _expected, ...query }) => query);
        return {
          postconditionVerified: true,
          postconditionObservation: coherentObservationPacket(
            { queries }, profileFacts({ queries }, false, 0, false),
          ),
        };
      }
      throw new Error(`UNEXPECTED_CLOSE_CONFIRMATION_INTENT:${intent.kind}`);
    });
    const result = await execute("close_gpt_execution_profile", fixture.browser, { profile });
    assert.equal(result.status, "success", result.failureCode ?? "close confirmation failed");
    assert.deepEqual(fixture.waitDurations(), recoveryObservation === 2 ? [1_500] : [1_500, 3_000]);
    assert.equal(observations, recoveryObservation);
    assert.equal(fixture.physicalMutations(), 1,
      "transient close confirmation must never duplicate the physical click");
  }
};

const exerciseUnresolvedProfileConfirmation = async (): Promise<void> => {
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") return coherentObservationPacket(intent, {});
    throw new Error(`UNRESOLVED_CLOSE_CONFIRMATION_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("close_gpt_execution_profile", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.deepEqual(fixture.waitDurations(), [1_500, 3_000]);
  assert.equal(fixture.physicalMutations(), 0);
};

const exerciseAbortedProfileConfirmation = async (): Promise<void> => {
  const controller = new AbortController();
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent, {});
    }
    throw new Error(`ABORTED_CLOSE_CONFIRMATION_MUST_NOT_ACT:${intent.kind}`);
  }, { onWait: () => controller.abort() });
  const result = await execute(
    "close_gpt_execution_profile", fixture.browser, { profile }, { signal: controller.signal },
  );
  assert.equal(result.status, "failed");
  assert.equal(result.failureCode, "GPT_EXECUTION_ABORTED");
  assert.equal(observations, 1, "abort after a stage wait must not issue another DOM read");
  assert.equal(fixture.physicalMutations(), 0);
};

const exerciseHardProfileContradiction = async (): Promise<void> => {
  let observations = 0;
  const fixture = fakeBrowser((intent) => {
    if (intent.kind === "observe") {
      observations += 1;
      return coherentObservationPacket(intent, observations === 1 ? {} : {
        ...profileFacts(intent, false, 0, false),
        trigger: { rawCount: 2, eligibleCount: 2 },
      });
    }
    throw new Error(`O1_HARD_PROFILE_FAILURE_MUST_NOT_ACT:${intent.kind}`);
  });
  const result = await execute("close_gpt_execution_profile", fixture.browser, { profile });
  assert.equal(result.status, "failed");
  assert.deepEqual(fixture.waitDurations(), [1_500],
    "an O1 hard contradiction must not request the 3-second stage");
  assert.equal(fixture.physicalMutations(), 0);
};

export const exerciseTransientProfileConfirmations = async (): Promise<void> => {
  await exerciseProfileRecoveryStages();
  await exerciseUnresolvedProfileConfirmation();
  await exerciseAbortedProfileConfirmation();
  await exerciseHardProfileContradiction();
};
