import { governanceAssert as assert } from "../../../../scripts/audit/shared/governance-exam-assert.js";

import { buildGptExecutionProfile } from "../index.js";
import {
  GPT_PROFILE_REASONING_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_ENABLED_CONTROL_SELECTOR,
  GPT_PROFILE_REASONING_VALUE_SELECTOR,
  GPT_PROFILE_SIMPLE_PANEL_SELECTOR,
  reasoningTierUiLabel,
  reasoningTierUiValue,
} from "./gpt-page-fixture-selectors.js";
import { coherentObservationPacket, fakeBrowser } from "./gpt-exact-target-browser-fixture.js";
import { execute, profile, profileFacts } from "./gpt-exact-target-profile-fixture.js";
import {
  exerciseFailedEvidenceReadback,
  exerciseReasoningEvidenceReadback,
} from "./gpt-failure-evidence-readback.acceptance-support.js";

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
  if (reasoningCase.mutation === "confirmed") {
    await exerciseReasoningEvidenceReadback(result, Object.freeze({ profile }));
  }
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
